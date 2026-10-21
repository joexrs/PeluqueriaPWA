-- Estado operativo de la cita y operaciones transaccionales desde la agenda.
-- Mantiene la columna booleana Estado para no romper reportes e integraciones
-- existentes que todavía la usan.

ALTER TABLE public."Cita"
  ADD COLUMN IF NOT EXISTS "Estado_Cita" text;

-- Las citas históricas activas pasan a pendiente; las inactivas, a cancelada.
UPDATE public."Cita"
   SET "Estado_Cita" = CASE WHEN "Estado" IS TRUE THEN 'PENDIENTE' ELSE 'CANCELADA' END
 WHERE "Estado_Cita" IS NULL;

ALTER TABLE public."Cita"
  ALTER COLUMN "Estado_Cita" SET DEFAULT 'PENDIENTE',
  ALTER COLUMN "Estado_Cita" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'CK_Cita_Estado_Cita'
       AND conrelid = 'public."Cita"'::regclass
  ) THEN
    ALTER TABLE public."Cita"
      ADD CONSTRAINT "CK_Cita_Estado_Cita"
      CHECK ("Estado_Cita" IN ('PENDIENTE','CONFIRMADA','EN_ATENCION','COMPLETADA','CANCELADA','NO_SHOW'));
  END IF;
END;
$$;

-- Sincroniza el campo legado cuando el bot u otro módulo solo escribe Estado.
CREATE OR REPLACE FUNCTION public.sincronizar_estado_cita()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_rol text;
  v_es_trabajador boolean;
  v_permitido boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."Estado" IS FALSE AND NEW."Estado_Cita" = 'PENDIENTE' THEN
      NEW."Estado_Cita" := 'CANCELADA';
    END IF;
  ELSIF NEW."Estado_Cita" IS DISTINCT FROM OLD."Estado_Cita" THEN
    NEW."Estado" := NEW."Estado_Cita" NOT IN ('CANCELADA','NO_SHOW');
  ELSIF NEW."Estado" IS DISTINCT FROM OLD."Estado" THEN
    NEW."Estado_Cita" := CASE WHEN NEW."Estado" IS TRUE THEN 'PENDIENTE' ELSE 'CANCELADA' END;
  END IF;

  -- Evita que una escritura directa por PostgREST salte la máquina de estados.
  IF TG_OP = 'UPDATE' AND NEW."Estado_Cita" IS DISTINCT FROM OLD."Estado_Cita"
     AND auth.uid() IS NOT NULL THEN
    v_rol := private.rol_actual();
    v_es_trabajador := private.tiene_rol('trabajador');
    v_permitido :=
      (OLD."Estado_Cita" = 'PENDIENTE' AND NEW."Estado_Cita" IN ('CONFIRMADA','CANCELADA','NO_SHOW')) OR
      (OLD."Estado_Cita" = 'CONFIRMADA' AND NEW."Estado_Cita" IN ('EN_ATENCION','CANCELADA','NO_SHOW')) OR
      (OLD."Estado_Cita" = 'EN_ATENCION' AND NEW."Estado_Cita" = 'COMPLETADA') OR
      (OLD."Estado_Cita" IN ('CANCELADA','NO_SHOW') AND NEW."Estado_Cita" = 'PENDIENTE' AND v_rol IN ('admin','jefe'));
    IF v_es_trabajador THEN
      v_permitido := private.es_mi_cita(OLD."ID") AND
        ((OLD."Estado_Cita" = 'CONFIRMADA' AND NEW."Estado_Cita" = 'EN_ATENCION') OR
         (OLD."Estado_Cita" = 'EN_ATENCION' AND NEW."Estado_Cita" = 'COMPLETADA'));
    END IF;
    IF NOT v_permitido THEN RAISE EXCEPTION 'Transición de estado no permitida.'; END IF;
    IF NEW."Estado_Cita" = 'NO_SHOW'
       AND (timezone('America/Lima', now())::date, timezone('America/Lima', now())::time) < (NEW.fecha_cita, NEW.hora_inicio) THEN
      RAISE EXCEPTION 'No se puede marcar inasistencia antes de la hora de la cita.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sincronizar_estado_cita ON public."Cita";
CREATE TRIGGER tr_sincronizar_estado_cita
BEFORE INSERT OR UPDATE ON public."Cita"
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_estado_cita();

-- Un solo punto de entrada para validar y persistir las transiciones.
CREATE OR REPLACE FUNCTION public.cambiar_estado_cita(p_cita_id integer, p_estado text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actual text;
  v_fecha date;
  v_inicio time;
  v_rol text := private.rol_actual();
  v_usuario_id integer := private.usuario_id_actual();
  v_cliente_id integer;
  v_venta_id integer;
  v_estado_venta text;
  v_es_trabajador boolean := private.tiene_rol('trabajador');
  v_permitido boolean := false;
BEGIN
  IF v_rol IS NULL THEN RAISE EXCEPTION 'Perfil activo requerido.'; END IF;
  SELECT c."Estado_Cita", c.fecha_cita, c.hora_inicio, c.cliente_id
    INTO v_actual, v_fecha, v_inicio, v_cliente_id
    FROM public."Cita" c WHERE c."ID" = p_cita_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la cita.'; END IF;
  IF v_es_trabajador AND NOT private.es_mi_cita(p_cita_id) THEN
    RAISE EXCEPTION 'Solo puedes actualizar tus propias citas.';
  END IF;

  v_permitido :=
    (v_actual = 'PENDIENTE' AND p_estado IN ('CONFIRMADA','CANCELADA','NO_SHOW')) OR
    (v_actual = 'CONFIRMADA' AND p_estado IN ('EN_ATENCION','CANCELADA','NO_SHOW')) OR
    (v_actual = 'EN_ATENCION' AND p_estado = 'COMPLETADA') OR
    (v_actual IN ('CANCELADA','NO_SHOW') AND p_estado = 'PENDIENTE' AND v_rol IN ('admin','jefe'));

  IF v_es_trabajador THEN
    v_permitido := (v_actual = 'CONFIRMADA' AND p_estado = 'EN_ATENCION') OR
                   (v_actual = 'EN_ATENCION' AND p_estado = 'COMPLETADA');
  END IF;
  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Transición de estado no permitida: % → %.', v_actual, p_estado;
  END IF;
  IF p_estado = 'NO_SHOW'
     AND (timezone('America/Lima', now())::date, timezone('America/Lima', now())::time) < (v_fecha, v_inicio) THEN
    RAISE EXCEPTION 'No se puede marcar inasistencia antes de la hora de la cita.';
  END IF;
  UPDATE public."Cita" SET "Estado_Cita" = p_estado WHERE "ID" = p_cita_id;

  -- Al terminar la atención queda una cuenta pendiente lista para cobrar.
  -- Si ya hay una cuenta pendiente o pagada, se conserva y no se duplica.
  IF p_estado = 'COMPLETADA' THEN
    SELECT v."ID", v."Estado_Venta"
      INTO v_venta_id, v_estado_venta
      FROM public."Venta" v
     WHERE v."Cita_ID" = p_cita_id
     ORDER BY v."Fecha_Venta" DESC
     LIMIT 1
     FOR UPDATE;
    IF NOT FOUND OR v_estado_venta = 'Cancelado' THEN
      INSERT INTO public."Venta" ("Cliente_ID", "Usuario_ID", "Cita_ID", "Estado_Venta", "Total")
      VALUES (v_cliente_id, v_usuario_id, p_cita_id, 'Pendiente', 0)
      RETURNING "ID" INTO v_venta_id;
      INSERT INTO public."Venta_Detalle" ("Venta_ID", "Servicio_ID", "Producto_ID", "Cantidad", "Precio_Unitario", "Estado_Detalle")
      SELECT v_venta_id, cs.servicio_id, NULL, cs."Cantidad", s."Precio", 'Pendiente'
        FROM public."Cita_Servicio" cs
        JOIN public."Servicio" s ON s."ID" = cs.servicio_id
       WHERE cs.cita_id = p_cita_id;
    END IF;
  END IF;
END;
$$;

-- Crea cabecera y servicios como una sola transacción para evitar citas vacías.
CREATE OR REPLACE FUNCTION public.crear_cita_con_servicios(
  p_cliente_id integer, p_fecha date, p_hora_inicio time, p_hora_fin time, p_servicios jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol text := private.rol_actual();
  v_cita_id integer;
  v_item jsonb;
  v_servicio_id integer;
  v_trabajador_id integer;
BEGIN
  IF v_rol NOT IN ('admin','jefe','recepcionista') THEN RAISE EXCEPTION 'No tienes permiso para crear citas.'; END IF;
  IF p_servicios IS NULL OR jsonb_typeof(p_servicios) <> 'array' OR jsonb_array_length(p_servicios) = 0 THEN
    RAISE EXCEPTION 'La cita debe incluir al menos un servicio.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."Cliente" c WHERE c."ID" = p_cliente_id) THEN
    RAISE EXCEPTION 'El cliente seleccionado no existe.';
  END IF;
  INSERT INTO public."Cita" (cliente_id, fecha_cita, hora_inicio, hora_fin, "Estado", "Estado_Cita")
  VALUES (p_cliente_id, p_fecha, p_hora_inicio, p_hora_fin, true, 'PENDIENTE')
  RETURNING "ID" INTO v_cita_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_servicios) LOOP
    v_servicio_id := (v_item->>'servicio_id')::integer;
    v_trabajador_id := (v_item->>'trabajador_id')::integer;
    IF NOT EXISTS (
      SELECT 1 FROM public."Servicio" s
       JOIN public."Trabajador_Servicio" ts ON ts."Servicio_id" = s."ID"
       WHERE s."ID" = v_servicio_id AND s."Estado" IS TRUE
         AND ts.usuario_id = v_trabajador_id AND ts."Estado" IS TRUE
    ) THEN RAISE EXCEPTION 'El trabajador no está habilitado para el servicio indicado.'; END IF;
    INSERT INTO public."Cita_Servicio" (cita_id, servicio_id, trabajador_id, orden, "Cantidad")
    VALUES (v_cita_id, v_servicio_id, v_trabajador_id,
            COALESCE((v_item->>'orden')::integer, 1), COALESCE((v_item->>'cantidad')::integer, 1));
  END LOOP;
  RETURN v_cita_id;
END;
$$;

-- Añade un servicio sin borrar los servicios que ya tenía la cita.
-- Extiende el horario y el detalle de venta dentro de la misma transacción.
CREATE OR REPLACE FUNCTION public.agregar_servicio_a_cita(
  p_cita_id integer, p_servicio_id integer, p_trabajador_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado text;
  v_actor integer := private.usuario_id_actual();
  v_rol text := private.rol_actual();
  v_duracion integer;
  v_precio numeric;
  v_venta_id integer;
  v_cliente_id integer;
BEGIN
  SELECT c."Estado_Cita", c.cliente_id INTO v_estado, v_cliente_id
    FROM public."Cita" c WHERE c."ID" = p_cita_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la cita.'; END IF;
  IF v_estado NOT IN ('PENDIENTE','CONFIRMADA','EN_ATENCION') THEN
    RAISE EXCEPTION 'No se pueden añadir servicios a una cita en estado %.', v_estado;
  END IF;
  IF v_rol = 'trabajador' THEN
    IF v_estado <> 'EN_ATENCION' OR NOT private.es_mi_cita(p_cita_id) OR p_trabajador_id <> v_actor THEN
      RAISE EXCEPTION 'Solo puedes añadir servicios a tu cita mientras está en atención.';
    END IF;
  ELSIF v_rol NOT IN ('admin','jefe','recepcionista') THEN
    RAISE EXCEPTION 'No tienes permiso para añadir servicios.';
  END IF;

  SELECT s."Duracion_minutos", s."Precio"
    INTO v_duracion, v_precio
    FROM public."Servicio" s
   WHERE s."ID" = p_servicio_id AND s."Estado" IS TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El servicio no existe o está inactivo.'; END IF;
  IF EXISTS (SELECT 1 FROM public."Venta" v WHERE v."Cita_ID" = p_cita_id AND v."Estado_Venta" <> 'Pendiente') THEN
    RAISE EXCEPTION 'No se pueden añadir servicios: la cuenta de la cita ya está cerrada.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."Trabajador_Servicio" ts
     WHERE ts.usuario_id = p_trabajador_id AND ts."Servicio_id" = p_servicio_id AND ts."Estado" IS TRUE
  ) THEN RAISE EXCEPTION 'El trabajador no está habilitado para este servicio.'; END IF;

  INSERT INTO public."Cita_Servicio" (cita_id, servicio_id, trabajador_id, orden, "Cantidad")
  SELECT p_cita_id, p_servicio_id, p_trabajador_id,
         COALESCE(MAX(cs.orden), 0) + 1, 1
    FROM public."Cita_Servicio" cs WHERE cs.cita_id = p_cita_id;

  UPDATE public."Cita"
     SET hora_fin = hora_fin + make_interval(mins => v_duracion)
   WHERE "ID" = p_cita_id;

  SELECT v."ID" INTO v_venta_id FROM public."Venta" v
   WHERE v."Cita_ID" = p_cita_id AND v."Estado_Venta" = 'Pendiente'
   ORDER BY v."Fecha_Venta" DESC LIMIT 1;
  IF v_venta_id IS NOT NULL THEN
    INSERT INTO public."Venta_Detalle" ("Venta_ID", "Servicio_ID", "Producto_ID", "Cantidad", "Precio_Unitario", "Estado_Detalle")
    VALUES (v_venta_id, p_servicio_id, NULL, 1, v_precio, 'Pendiente');
  END IF;
END;
$$;

-- Añade un producto a la venta de la cita; crea la cuenta si aún no existe.
CREATE OR REPLACE FUNCTION public.agregar_producto_a_cita(
  p_cita_id integer, p_producto_id integer, p_cantidad integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado text;
  v_actor integer := private.usuario_id_actual();
  v_rol text := private.rol_actual();
  v_cliente_id integer;
  v_precio numeric;
  v_venta_id integer;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero.'; END IF;
  SELECT c."Estado_Cita", c.cliente_id INTO v_estado, v_cliente_id
    FROM public."Cita" c WHERE c."ID" = p_cita_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la cita.'; END IF;
  IF v_estado <> 'EN_ATENCION' THEN RAISE EXCEPTION 'Solo se pueden añadir productos durante la atención.'; END IF;
  IF v_rol = 'trabajador' THEN
    IF NOT private.es_mi_cita(p_cita_id) THEN RAISE EXCEPTION 'Solo puedes añadir productos a tus citas.'; END IF;
  ELSIF v_rol NOT IN ('admin','jefe','recepcionista') THEN
    RAISE EXCEPTION 'No tienes permiso para añadir productos.';
  END IF;

  SELECT p."Precio" INTO v_precio FROM public."Producto" p
   WHERE p."ID" = p_producto_id AND p."Estado" IS TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El producto no existe o está inactivo.'; END IF;

  SELECT v."ID" INTO v_venta_id FROM public."Venta" v
   WHERE v."Cita_ID" = p_cita_id ORDER BY v."Fecha_Venta" DESC LIMIT 1 FOR UPDATE;
  IF v_venta_id IS NULL THEN
    INSERT INTO public."Venta" ("Cliente_ID", "Usuario_ID", "Cita_ID", "Estado_Venta", "Total")
    VALUES (v_cliente_id, v_actor, p_cita_id, 'Pendiente', 0)
    RETURNING "ID" INTO v_venta_id;
    INSERT INTO public."Venta_Detalle" ("Venta_ID", "Servicio_ID", "Producto_ID", "Cantidad", "Precio_Unitario", "Estado_Detalle")
    SELECT v_venta_id, cs.servicio_id, NULL, cs."Cantidad", s."Precio", 'Pendiente'
      FROM public."Cita_Servicio" cs JOIN public."Servicio" s ON s."ID" = cs.servicio_id
     WHERE cs.cita_id = p_cita_id;
  ELSIF EXISTS (SELECT 1 FROM public."Venta" v WHERE v."ID" = v_venta_id AND v."Estado_Venta" <> 'Pendiente') THEN
    RAISE EXCEPTION 'La venta de esta cita ya no está pendiente.';
  END IF;

  INSERT INTO public."Venta_Detalle" ("Venta_ID", "Servicio_ID", "Producto_ID", "Cantidad", "Precio_Unitario", "Estado_Detalle")
  VALUES (v_venta_id, NULL, p_producto_id, p_cantidad, v_precio, 'Pendiente');
  RETURN v_venta_id;
END;
$$;

-- Cierra el cobro y registra el medio de pago dentro de una sola transacción.
CREATE OR REPLACE FUNCTION public.registrar_pago_cita(
  p_cita_id integer, p_metodo_pago text, p_monto_recibido numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol text := private.rol_actual();
  v_venta_id integer;
  v_total numeric;
BEGIN
  IF v_rol NOT IN ('admin','jefe','recepcionista') THEN RAISE EXCEPTION 'No tienes permiso para registrar pagos.'; END IF;
  IF p_metodo_pago NOT IN ('efectivo','tarjeta','transferencia','yape','plin') THEN
    RAISE EXCEPTION 'El método de pago no es válido.';
  END IF;
  SELECT v."ID", v."Total" INTO v_venta_id, v_total
    FROM public."Venta" v
   WHERE v."Cita_ID" = p_cita_id AND v."Estado_Venta" = 'Pendiente'
   ORDER BY v."Fecha_Venta" DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay una cuenta pendiente para esta cita.'; END IF;
  IF p_monto_recibido IS NULL OR p_monto_recibido < v_total THEN
    RAISE EXCEPTION 'El importe recibido no cubre el total de la cuenta.';
  END IF;
  UPDATE public."Venta_Detalle"
     SET "Estado_Detalle" = 'Pagado'
   WHERE "Venta_ID" = v_venta_id AND "Estado_Detalle" = 'Pendiente';
  UPDATE public."Venta" SET "Metodo_Pago" = p_metodo_pago WHERE "ID" = v_venta_id;
END;
$$;

-- Permite al trabajador asignado consultar la cuenta y sus líneas desde el detalle.
CREATE OR REPLACE FUNCTION private.es_mi_venta(p_venta_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Venta" v
     WHERE v."ID" = p_venta_id AND private.es_mi_cita(v."Cita_ID")
  );
$$;
REVOKE ALL ON FUNCTION private.es_mi_venta(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.es_mi_venta(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.cambiar_estado_cita(integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_cita_con_servicios(integer,date,time,time,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agregar_servicio_a_cita(integer,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agregar_producto_a_cita(integer,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_pago_cita(integer,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_cita(integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_cita_con_servicios(integer,date,time,time,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agregar_servicio_a_cita(integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agregar_producto_a_cita(integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cita(integer,text,numeric) TO authenticated;

-- Las escrituras de trabajadores pasan por los RPC SECURITY DEFINER, que
-- validan rol, asignación y transición sin abrir UPDATE/INSERT directo por RLS.

-- El trabajador necesita consultar el catálogo comercial, pero no los lotes.
DROP POLICY IF EXISTS "rls_trabajador_lee_productos_activos" ON public."Producto";
CREATE POLICY "rls_trabajador_lee_productos_activos" ON public."Producto"
  FOR SELECT TO authenticated
  USING (private.tiene_rol('trabajador') AND "Estado" IS TRUE);

DROP POLICY IF EXISTS "rls_trabajador_lee_venta_de_sus_citas" ON public."Venta";
CREATE POLICY "rls_trabajador_lee_venta_de_sus_citas" ON public."Venta"
  FOR SELECT TO authenticated
  USING (private.tiene_rol('trabajador') AND private.es_mi_cita("Cita_ID"));

DROP POLICY IF EXISTS "rls_trabajador_lee_detalle_de_sus_ventas" ON public."Venta_Detalle";
CREATE POLICY "rls_trabajador_lee_detalle_de_sus_ventas" ON public."Venta_Detalle"
  FOR SELECT TO authenticated
  USING (private.tiene_rol('trabajador') AND private.es_mi_venta("Venta_ID"));

NOTIFY pgrst, 'reload schema';
