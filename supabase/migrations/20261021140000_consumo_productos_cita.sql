-- Distingue el consumo de inventario durante el servicio de los productos vendidos.
ALTER TABLE public."Movimientos"
  ADD COLUMN IF NOT EXISTS "Cita_ID" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'FK_Movimientos_Cita'
       AND conrelid = 'public."Movimientos"'::regclass
  ) THEN
    ALTER TABLE public."Movimientos"
      ADD CONSTRAINT "FK_Movimientos_Cita" FOREIGN KEY ("Cita_ID")
      REFERENCES public."Cita"("ID") ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_movimientos_cita ON public."Movimientos"("Cita_ID");

-- Consume lotes por FIFO y registra cada salida vinculada a la cita en una transacción.
CREATE OR REPLACE FUNCTION public.consumir_producto_en_cita(
  p_cita_id integer,
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
  v_estado_cita text;
  v_disponible integer;
  v_pendiente integer;
  v_lote record;
  v_tomar integer;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;
  IF v_rol NOT IN ('admin','jefe','recepcionista','trabajador') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar consumo de productos.';
  END IF;

  SELECT c."Estado_Cita" INTO v_estado_cita
    FROM public."Cita" c WHERE c."ID" = p_cita_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la cita.'; END IF;
  IF v_estado_cita <> 'EN_ATENCION' THEN
    RAISE EXCEPTION 'Solo se pueden registrar productos usados durante la atención.';
  END IF;
  IF v_rol = 'trabajador' AND NOT private.es_mi_cita(p_cita_id) THEN
    RAISE EXCEPTION 'Solo puedes registrar consumo en tus propias citas.';
  END IF;

  PERFORM 1 FROM public."Producto" p
   WHERE p."ID" = p_producto_id AND p."Estado" IS TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El producto no existe o está inactivo.'; END IF;

  -- Serializa el consumo con otras operaciones que bloquean lotes.
  PERFORM l."ID" FROM public."Lote" l
   WHERE l."Producto_id" = p_producto_id AND l."Estado" IS TRUE AND l."Cantidad" > 0
   ORDER BY l."Fecha_vencimiento", l."Fecha_ingreso", l."ID"
   FOR UPDATE;

  SELECT COALESCE(SUM(l."Cantidad"), 0)::integer INTO v_disponible
    FROM public."Lote" l
   WHERE l."Producto_id" = p_producto_id AND l."Estado" IS TRUE AND l."Cantidad" > 0;
  IF v_disponible < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %.', v_disponible;
  END IF;

  v_pendiente := p_cantidad;
  FOR v_lote IN
    SELECT l."ID", l."Cantidad"
      FROM public."Lote" l
     WHERE l."Producto_id" = p_producto_id AND l."Estado" IS TRUE AND l."Cantidad" > 0
     ORDER BY l."Fecha_vencimiento", l."Fecha_ingreso", l."ID"
     FOR UPDATE
  LOOP
    EXIT WHEN v_pendiente = 0;
    v_tomar := LEAST(v_pendiente, v_lote."Cantidad");
    UPDATE public."Lote" SET "Cantidad" = "Cantidad" - v_tomar WHERE "ID" = v_lote."ID";
    INSERT INTO public."Movimientos" ("Cantidad", "Tipo", "Lote_id", "Producto_id", "Cita_ID", "Estado")
    VALUES (v_tomar, 'Salida', v_lote."ID", p_producto_id, p_cita_id, true);
    v_pendiente := v_pendiente - v_tomar;
  END LOOP;

  UPDATE public."Producto"
     SET "Stock_total" = "Stock_total" - p_cantidad
   WHERE "ID" = p_producto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_producto_en_cita(integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consumir_producto_en_cita(integer,integer,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
