-- Restore the stock-entry RPC for databases where the inventory migration
-- created the tables but did not install the function.
CREATE OR REPLACE FUNCTION public.registrar_entrada_inventario(
  p_producto_id integer,
  p_cantidad integer,
  p_fecha_vencimiento date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol text := private.rol_actual();
  v_lote_id integer;
BEGIN
  IF v_rol NOT IN ('admin', 'jefe') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar entradas de inventario.';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;
  IF p_fecha_vencimiento IS NULL
     OR p_fecha_vencimiento < timezone('America/Lima', now())::date THEN
    RAISE EXCEPTION 'La fecha de vencimiento no puede estar en el pasado.';
  END IF;

  PERFORM 1
    FROM public."Producto" p
   WHERE p."ID" = p_producto_id
     AND p."Estado" IS TRUE
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no existe o está inactivo.';
  END IF;

  INSERT INTO public."Lote" (
    "Fecha_vencimiento", "Fecha_ingreso", "Cantidad", "Producto_id", "Estado"
  )
  VALUES (
    p_fecha_vencimiento, timezone('America/Lima', now())::date,
    p_cantidad, p_producto_id, true
  )
  RETURNING "ID" INTO v_lote_id;

  INSERT INTO public."Movimientos" (
    "Cantidad", "Tipo", "Lote_id", "Producto_id", "Estado"
  )
  VALUES (p_cantidad, 'Entrada', v_lote_id, p_producto_id, true);

  UPDATE public."Producto" p
     SET "Stock_total" = COALESCE((
       SELECT SUM(l."Cantidad")::integer
         FROM public."Lote" l
        WHERE l."Producto_id" = p_producto_id
          AND l."Estado" IS TRUE
     ), 0)
   WHERE p."ID" = p_producto_id;

  RETURN v_lote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_entrada_inventario(integer, integer, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_inventario(integer, integer, date)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
