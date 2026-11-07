-- Add the movement metadata required to link stock deductions to a sale.
ALTER TABLE public."Movimientos"
  ADD COLUMN IF NOT EXISTS "Venta_ID" integer,
  ADD COLUMN IF NOT EXISTS "Motivo" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'FK_Movimientos_Venta'
       AND conrelid = 'public."Movimientos"'::regclass
  ) THEN
    ALTER TABLE public."Movimientos"
      ADD CONSTRAINT "FK_Movimientos_Venta"
      FOREIGN KEY ("Venta_ID")
      REFERENCES public."Venta" ("ID")
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_movimientos_venta
  ON public."Movimientos" ("Venta_ID");

CREATE OR REPLACE FUNCTION public.descontar_stock_fefo(
  p_producto_id integer,
  p_cantidad integer,
  p_motivo text,
  p_cita_id integer DEFAULT NULL,
  p_venta_id integer DEFAULT NULL,
  p_permitir_vencidos boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_disponible integer;
  v_pendiente integer;
  v_lote record;
  v_tomar integer;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;

  PERFORM 1
    FROM public."Producto" p
   WHERE p."ID" = p_producto_id
     AND p."Estado" IS TRUE
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no existe o está inactivo.';
  END IF;

  PERFORM l."ID"
    FROM public."Lote" l
   WHERE l."Producto_id" = p_producto_id
     AND l."Estado" IS TRUE
     AND l."Cantidad" > 0
     AND (p_permitir_vencidos OR l."Fecha_vencimiento" >= timezone('America/Lima', now())::date)
   ORDER BY l."Fecha_vencimiento", l."Fecha_ingreso", l."ID"
   FOR UPDATE;

  SELECT COALESCE(SUM(l."Cantidad"), 0)::integer
    INTO v_disponible
    FROM public."Lote" l
   WHERE l."Producto_id" = p_producto_id
     AND l."Estado" IS TRUE
     AND l."Cantidad" > 0
     AND (p_permitir_vencidos OR l."Fecha_vencimiento" >= timezone('America/Lima', now())::date);
  IF v_disponible < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible en lotes utilizables: %.', v_disponible;
  END IF;

  v_pendiente := p_cantidad;
  FOR v_lote IN
    SELECT l."ID", l."Cantidad"
      FROM public."Lote" l
     WHERE l."Producto_id" = p_producto_id
       AND l."Estado" IS TRUE
       AND l."Cantidad" > 0
       AND (p_permitir_vencidos OR l."Fecha_vencimiento" >= timezone('America/Lima', now())::date)
     ORDER BY l."Fecha_vencimiento", l."Fecha_ingreso", l."ID"
     FOR UPDATE
  LOOP
    EXIT WHEN v_pendiente = 0;
    v_tomar := LEAST(v_pendiente, v_lote."Cantidad");

    UPDATE public."Lote"
       SET "Cantidad" = "Cantidad" - v_tomar
     WHERE "ID" = v_lote."ID";

    INSERT INTO public."Movimientos" (
      "Cantidad", "Tipo", "Lote_id", "Producto_id", "Cita_ID", "Venta_ID", "Motivo", "Estado"
    )
    VALUES (
      v_tomar, 'Salida', v_lote."ID", p_producto_id, p_cita_id, p_venta_id, p_motivo, true
    );

    v_pendiente := v_pendiente - v_tomar;
  END LOOP;

  UPDATE public."Producto" p
     SET "Stock_total" = COALESCE((
       SELECT SUM(l."Cantidad")::integer
         FROM public."Lote" l
        WHERE l."Producto_id" = p_producto_id
          AND l."Estado" IS TRUE
     ), 0)
   WHERE p."ID" = p_producto_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.agregar_producto_a_venta(
  p_venta_id integer,
  p_producto_id integer,
  p_cantidad integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol text := private.rol_actual();
  v_estado text;
  v_cita_id integer;
  v_precio numeric;
BEGIN
  IF v_rol NOT IN ('admin', 'jefe', 'recepcionista') THEN
    RAISE EXCEPTION 'No tienes permiso para añadir productos a ventas.';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;

  SELECT v."Estado_Venta", v."Cita_ID"
    INTO v_estado, v_cita_id
    FROM public."Venta" v
   WHERE v."ID" = p_venta_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la venta.';
  END IF;
  IF v_estado <> 'Pendiente' THEN
    RAISE EXCEPTION 'La venta ya no está pendiente.';
  END IF;

  SELECT p."Precio"
    INTO v_precio
    FROM public."Producto" p
   WHERE p."ID" = p_producto_id
     AND p."Estado" IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no existe o está inactivo.';
  END IF;

  PERFORM public.descontar_stock_fefo(
    p_producto_id, p_cantidad, 'VENTA', v_cita_id, p_venta_id, false
  );

  INSERT INTO public."Venta_Detalle" (
    "Venta_ID", "Servicio_ID", "Producto_ID", "Cantidad", "Precio_Unitario", "Estado_Detalle"
  )
  VALUES (p_venta_id, NULL, p_producto_id, p_cantidad, v_precio, 'Pendiente');
END;
$$;

REVOKE ALL ON FUNCTION public.descontar_stock_fefo(integer, integer, text, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agregar_producto_a_venta(integer, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agregar_producto_a_venta(integer, integer, integer)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
