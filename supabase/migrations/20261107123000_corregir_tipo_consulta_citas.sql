-- Align the public RPC result types with the varchar columns in Cliente.
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
    c."ID" AS cita_id,
    c.fecha_cita,
    c.hora_inicio,
    c.hora_fin,
    c."Estado_Cita" AS estado_cita,
    cl."Nombre"::text AS cliente_nombre,
    COALESCE(string_agg(DISTINCT s."Nombre", ', '), 'Servicio general') AS servicios,
    COALESCE((
      SELECT u."Nombre" || ' ' || substring(u."Apellido" FROM 1 FOR 1) || '.'
      FROM public."Cita_Servicio" cs2
      JOIN public."Trabajador_Servicio" ts
        ON ts.usuario_id = cs2.trabajador_id
       AND ts."Servicio_id" = cs2.servicio_id
      JOIN public."Usuario" u ON u."ID" = ts.usuario_id
      WHERE cs2.cita_id = c."ID"
      LIMIT 1
    ), 'Profesional por asignar') AS barbero
  FROM public."Cita" c
  JOIN public."Cliente" cl ON cl."ID" = c.cliente_id
  LEFT JOIN public."Cita_Servicio" cs ON cs.cita_id = c."ID"
  LEFT JOIN public."Servicio" s ON s."ID" = cs.servicio_id
  WHERE trim(regexp_replace(COALESCE(cl."DNI", ''), '[^0-9a-zA-Z]', '', 'g')) = v_dni_limpio
    AND cl."Estado" IS TRUE
  GROUP BY c."ID", c.fecha_cita, c.hora_inicio, c.hora_fin, c."Estado_Cita", cl."Nombre"
  ORDER BY c.fecha_cita DESC, c.hora_inicio DESC
  LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.consultar_citas_por_dni(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_citas_por_dni(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
