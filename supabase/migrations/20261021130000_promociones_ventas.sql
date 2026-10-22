-- Guarda el descuento por línea para que la promoción quede reflejada en el total
-- y no dependa únicamente del cálculo visual del navegador.
ALTER TABLE public."Venta_Detalle"
  ADD COLUMN IF NOT EXISTS "Promocion_ID" integer REFERENCES public."Promocion"("ID") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "Descuento_Porcentaje" numeric(5,2) NOT NULL DEFAULT 0
    CHECK ("Descuento_Porcentaje" BETWEEN 0 AND 100);

-- El total suma servicios con descuento y productos a su precio normal.
CREATE OR REPLACE FUNCTION public.actualizar_estado_venta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_ids integer[];
  v_venta_id integer;
  v_total_lin integer;
  v_cancelados integer;
  v_pagados integer;
  v_total numeric(10,2);
  v_nuevo varchar(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD."Venta_ID"];
  ELSIF TG_OP = 'UPDATE' AND OLD."Venta_ID" IS DISTINCT FROM NEW."Venta_ID" THEN
    v_ids := ARRAY[OLD."Venta_ID", NEW."Venta_ID"];
  ELSE
    v_ids := ARRAY[NEW."Venta_ID"];
  END IF;

  FOREACH v_venta_id IN ARRAY v_ids LOOP
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE "Estado_Detalle" = 'Cancelado'),
           COUNT(*) FILTER (WHERE "Estado_Detalle" = 'Pagado'),
           COALESCE(SUM("Subtotal" * (1 - "Descuento_Porcentaje" / 100)), 0)
      INTO v_total_lin, v_cancelados, v_pagados, v_total
      FROM public."Venta_Detalle"
     WHERE "Venta_ID" = v_venta_id AND "Estado_Detalle" <> 'Cancelado';

    IF v_total_lin = 0 THEN
      v_nuevo := 'Pendiente';
    ELSIF v_pagados = v_total_lin THEN
      v_nuevo := 'Pagado';
    ELSE
      v_nuevo := 'Pendiente';
    END IF;

    IF v_cancelados > 0 AND v_cancelados = (SELECT COUNT(*) FROM public."Venta_Detalle" WHERE "Venta_ID" = v_venta_id) THEN
      v_nuevo := 'Cancelado';
    END IF;

    UPDATE public."Venta"
       SET "Estado_Venta" = v_nuevo, "Total" = v_total
     WHERE "ID" = v_venta_id
       AND ("Estado_Venta" IS DISTINCT FROM v_nuevo OR "Total" IS DISTINCT FROM v_total);
  END LOOP;
  RETURN NULL;
END;
$$;

-- Aplica o reemplaza una promoción sobre los servicios elegibles de una venta pendiente.
CREATE OR REPLACE FUNCTION public.aplicar_promocion_venta(p_venta_id integer, p_promocion_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol text := private.rol_actual();
  v_porcentaje numeric(5,2);
  v_servicio_id integer;
  v_estado text;
  v_aplicados integer;
BEGIN
  IF v_rol NOT IN ('admin','jefe','recepcionista') THEN
    RAISE EXCEPTION 'No tienes permiso para aplicar promociones.';
  END IF;

  SELECT "Estado_Venta" INTO v_estado
    FROM public."Venta" WHERE "ID" = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la venta.'; END IF;
  IF v_estado <> 'Pendiente' THEN RAISE EXCEPTION 'Solo se puede descontar una venta pendiente.'; END IF;

  SELECT "Porcentaje_Descuento", "Servicio_ID"
    INTO v_porcentaje, v_servicio_id
    FROM public."Promocion"
   WHERE "ID" = p_promocion_id AND "Estado" IS TRUE
     AND "Fecha_Inicio" <= timezone('America/Lima', now())::date
     AND "Fecha_Fin" >= timezone('America/Lima', now())::date;
  IF NOT FOUND THEN RAISE EXCEPTION 'La promoción no existe, está inactiva o fuera de vigencia.'; END IF;

  UPDATE public."Venta_Detalle"
     SET "Promocion_ID" = NULL, "Descuento_Porcentaje" = 0
   WHERE "Venta_ID" = p_venta_id AND "Estado_Detalle" = 'Pendiente' AND "Servicio_ID" IS NOT NULL;

  UPDATE public."Venta_Detalle"
     SET "Promocion_ID" = p_promocion_id, "Descuento_Porcentaje" = v_porcentaje
   WHERE "Venta_ID" = p_venta_id AND "Estado_Detalle" = 'Pendiente'
     AND "Servicio_ID" IS NOT NULL
     AND (v_servicio_id IS NULL OR "Servicio_ID" = v_servicio_id);
  GET DIAGNOSTICS v_aplicados = ROW_COUNT;
  IF v_aplicados = 0 THEN RAISE EXCEPTION 'Esta venta no contiene servicios elegibles para la promoción.'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_promocion_venta(integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_promocion_venta(integer,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
