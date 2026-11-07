-- Restore the manual inventory stock-out RPC used by the products page.
CREATE OR REPLACE FUNCTION public.registrar_salida_inventario(
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
BEGIN
  IF v_rol NOT IN ('admin', 'jefe') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar salidas de inventario.';
  END IF;

  PERFORM public.descontar_stock_fefo(
    p_producto_id,
    p_cantidad,
    'SALIDA_MANUAL',
    NULL,
    NULL,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_salida_inventario(integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_salida_inventario(integer, integer)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
