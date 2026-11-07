-- =====================================================================
-- MIGRACIÓN: Corrección de pago seguro y consulta pública de citas por DNI
-- =====================================================================

-- 1. CORRECCIÓN Y ROBUSTECIMIENTO DE REGISTRAR PAGO DE VENTA
-- Soluciona problemas de redondeo en punto flotante y asegura el cierre de cuenta.
CREATE OR REPLACE FUNCTION public.registrar_pago_venta(
  p_venta_id integer,
  p_metodo_pago text,
  p_monto_recibido numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol text := private.rol_actual();
  v_total numeric;
  v_estado text;
  v_monto_redondeado numeric;
  v_total_redondeado numeric;
BEGIN
  IF v_rol NOT IN ('admin','jefe','recepcionista') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar pagos.';
  END IF;

  IF p_metodo_pago IS NULL OR lower(trim(p_metodo_pago)) NOT IN ('efectivo','tarjeta','transferencia','yape','plin') THEN
    RAISE EXCEPTION 'El método de pago no es válido. Debe ser efectivo, tarjeta, transferencia, yape o plin.';
  END IF;

  SELECT v."Total", v."Estado_Venta"
    INTO v_total, v_estado
    FROM public."Venta" v
   WHERE v."ID" = p_venta_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la venta especificada.';
  END IF;

  IF v_estado <> 'Pendiente' THEN
    RAISE EXCEPTION 'La venta ya se encuentra en estado % y no puede cobrarse nuevamente.', v_estado;
  END IF;

  -- Redondeo a 2 decimales para evitar rechazos por precisión flotante (ej. 34.00 vs 33.999999)
  v_monto_redondeado := ROUND(COALESCE(p_monto_recibido, 0)::numeric, 2);
  v_total_redondeado := ROUND(COALESCE(v_total, 0)::numeric, 2);

  IF v_monto_redondeado < v_total_redondeado THEN
    RAISE EXCEPTION 'El importe recibido (S/ %) no cubre el total de la cuenta (S/ %).', v_monto_redondeado, v_total_redondeado;
  END IF;

  -- Actualiza los detalles pendientes a Pagado
  UPDATE public."Venta_Detalle"
     SET "Estado_Detalle" = 'Pagado'
   WHERE "Venta_ID" = p_venta_id
     AND "Estado_Detalle" = 'Pendiente';

  -- Guarda el medio de pago y asegura el estado Pagado
  UPDATE public."Venta"
     SET "Metodo_Pago"  = lower(trim(p_metodo_pago)),
         "Estado_Venta" = 'Pagado'
   WHERE "ID" = p_venta_id;

END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago_venta(integer,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_venta(integer,text,numeric) TO authenticated;

-- 2. PROCEDIMIENTO PÚBLICO SEGURO PARA CONSULTA DE CITAS POR DNI
-- No expone PII sensible (sin teléfonos, ni DNI retornado, ni correos, ni notas internas).
CREATE OR REPLACE FUNCTION public.consultar_citas_por_dni(p_dni text)
RETURNS TABLE (
  cita_id integer,
  fecha_cita date,
  hora_inicio time,
  hora_fin time,
  estado_cita text,
  cliente_nombre text,
  servicios text,
  barbero text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dni_limpio text;
BEGIN
  v_dni_limpio := trim(regexp_replace(COALESCE(p_dni, ''), '[^0-9a-zA-Z]', '', 'g'));

  IF v_dni_limpio IS NULL OR length(v_dni_limpio) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c."ID" as cita_id,
    c.fecha_cita,
    c.hora_inicio,
    c.hora_fin,
    c."Estado_Cita" as estado_cita,
    cl."Nombre" as cliente_nombre,
    COALESCE(string_agg(DISTINCT s."Nombre", ', '), 'Servicio general') as servicios,
    COALESCE((
      SELECT u."Nombre" || ' ' || substring(u."Apellido" from 1 for 1) || '.'
      FROM public."Cita_Servicio" cs2
      JOIN public."Trabajador_Servicio" ts ON ts.usuario_id = cs2.trabajador_id AND ts."Servicio_id" = cs2.servicio_id
      JOIN public."Usuario" u ON u."ID" = ts.usuario_id
      WHERE cs2.cita_id = c."ID"
      LIMIT 1
    ), 'Profesional por asignar') as barbero
  FROM public."Cita" c
  JOIN public."Cliente" cl ON cl."ID" = c.cliente_id
  LEFT JOIN public."Cita_Servicio" cs ON cs.cita_id = c."ID"
  LEFT JOIN public."Servicio" s ON s."ID" = cs.servicio_id
  WHERE cl."DNI" = v_dni_limpio
    AND cl."Estado" IS TRUE
  GROUP BY c."ID", c.fecha_cita, c.hora_inicio, c.hora_fin, c."Estado_Cita", cl."Nombre"
  ORDER BY c.fecha_cita DESC, c.hora_inicio DESC
  LIMIT 25;
END;
$$;

-- Permitir ejecución pública (anon) y autenticada
REVOKE ALL ON FUNCTION public.consultar_citas_por_dni(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_citas_por_dni(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

