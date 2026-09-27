-- ═══════════════════════════════════════════════════════════════════════════
-- validacion_aforo_y_concurrencia.sql
-- Propuesta de constraints para evitar doble reserva de trabajadores
-- y respetar el aforo simultáneo por servicio.
--
-- EJECUTAR en el SQL Editor de Supabase (Dashboard → SQL Editor).
-- La extensión btree_gist ya está instalada según el enunciado.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Índice funcional para acelerar las consultas de overlap ──────────────
--
-- PostgreSQL necesita tipos de rango para EXCLUDE; creamos una función
-- auxiliar que convierte (fecha, hora_inicio, hora_fin) en tstzrange.

CREATE OR REPLACE FUNCTION cita_rango(fecha date, inicio time, fin time)
RETURNS tstzrange
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT tstzrange(
    (fecha || ' ' || inicio)::timestamptz,
    (fecha || ' ' || fin)::timestamptz,
    '[)'
  )
$$;

-- ─── 2. EXCLUDE: un trabajador no puede tener dos citas solapadas ─────────────
--
-- Condición: mismo trabajador, mismo día, rango horario superpuesto,
-- y al menos una de las citas no está cancelada.
-- No se aplica cuando trabajador_id IS NULL (cita sin asignar).

ALTER TABLE public.citas
  ADD CONSTRAINT no_doble_reserva_trabajador
  EXCLUDE USING gist (
    trabajador_id WITH =,
    cita_rango(fecha, hora_inicio, hora_fin) WITH &&
  )
  WHERE (
    trabajador_id IS NOT NULL
    AND estado NOT IN ('CANCELADA', 'NO_SHOW')
  );

-- ─── 3. Función: verifica aforo simultáneo por servicio ──────────────────────
--
-- El constraint EXCLUDE anterior no puede cubrir el aforo (que depende
-- del catálogo de servicios, no de un único trabajador). Usamos un trigger.
--
-- La lógica:
--   Para cada servicio en la cita nueva, contamos cuántas citas activas
--   ese mismo día y en rango superpuesto ya incluyen ese servicio.
--   Si el conteo >= aforo_simultaneo_maximo, rechazamos.

CREATE OR REPLACE FUNCTION verificar_aforo_servicio()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_servicio_id  uuid;
  v_aforo_max    integer;
  v_ocupado      integer;
BEGIN
  -- Iterar sobre cada servicio de la cita que se está insertando/actualizando
  FOR v_servicio_id IN
    SELECT servicio_id
    FROM public.detalle_citas_servicios
    WHERE cita_id = NEW.cita_id
  LOOP
    -- Aforo simultáneo máximo para este servicio
    SELECT aforo_simultaneo_maximo
    INTO v_aforo_max
    FROM public.servicios
    WHERE id = v_servicio_id;

    -- Citas activas que incluyen este servicio y se solapan en el tiempo
    SELECT COUNT(*)
    INTO v_ocupado
    FROM public.citas c
    JOIN public.detalle_citas_servicios dcs ON dcs.cita_id = c.id
    WHERE
      dcs.servicio_id = v_servicio_id
      AND c.fecha = (SELECT fecha FROM public.citas WHERE id = NEW.cita_id)
      AND c.estado NOT IN ('CANCELADA', 'NO_SHOW')
      AND c.id <> NEW.cita_id   -- excluir la cita actual en actualizaciones
      AND cita_rango(c.fecha, c.hora_inicio, c.hora_fin)
          && cita_rango(
               (SELECT fecha FROM public.citas WHERE id = NEW.cita_id),
               (SELECT hora_inicio FROM public.citas WHERE id = NEW.cita_id),
               (SELECT hora_fin FROM public.citas WHERE id = NEW.cita_id)
             );

    IF v_ocupado >= v_aforo_max THEN
      RAISE EXCEPTION
        'Aforo simultáneo agotado para el servicio "%". Máximo: %, ocupado: %',
        (SELECT nombre FROM public.servicios WHERE id = v_servicio_id),
        v_aforo_max,
        v_ocupado
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ─── 4. Trigger que llama a la función en cada detalle insertado ──────────────
--
-- Se dispara en INSERT/UPDATE de detalle_citas_servicios (no en citas),
-- porque es cuando se sabe cuál servicio incluye la cita.

DROP TRIGGER IF EXISTS trg_verificar_aforo ON public.detalle_citas_servicios;

CREATE TRIGGER trg_verificar_aforo
  AFTER INSERT OR UPDATE ON public.detalle_citas_servicios
  FOR EACH ROW
  EXECUTE FUNCTION verificar_aforo_servicio();


-- ─── 5. Función: verifica aforo DIARIO por servicio (límite de citas/día) ────
--
-- aforo_maximo_diario es un límite diferente: cuántas citas puede tener
-- ese servicio en todo el día, independientemente del horario.

CREATE OR REPLACE FUNCTION verificar_aforo_diario()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_aforo_diario integer;
  v_total_dia    integer;
  v_fecha        date;
BEGIN
  -- Fecha de la cita
  SELECT fecha INTO v_fecha FROM public.citas WHERE id = NEW.cita_id;

  -- Aforo diario máximo para el servicio
  SELECT aforo_maximo_diario INTO v_aforo_diario
  FROM public.servicios WHERE id = NEW.servicio_id;

  -- Contar citas activas para este servicio en ese día
  SELECT COUNT(*)
  INTO v_total_dia
  FROM public.citas c
  JOIN public.detalle_citas_servicios dcs ON dcs.cita_id = c.id
  WHERE
    dcs.servicio_id = NEW.servicio_id
    AND c.fecha = v_fecha
    AND c.estado NOT IN ('CANCELADA', 'NO_SHOW')
    AND c.id <> NEW.cita_id;

  IF v_total_dia >= v_aforo_diario THEN
    RAISE EXCEPTION
      'Aforo diario agotado para el servicio "%". Máximo diario: %',
      (SELECT nombre FROM public.servicios WHERE id = NEW.servicio_id),
      v_aforo_diario
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verificar_aforo_diario ON public.detalle_citas_servicios;

CREATE TRIGGER trg_verificar_aforo_diario
  BEFORE INSERT OR UPDATE ON public.detalle_citas_servicios
  FOR EACH ROW
  EXECUTE FUNCTION verificar_aforo_diario();


-- ─── 6. (Opcional) Vista de disponibilidad para un servicio+día ───────────────
--
-- Útil para el selector de horarios en el frontend.

CREATE OR REPLACE VIEW public.v_disponibilidad_servicios AS
SELECT
  s.id            AS servicio_id,
  s.nombre        AS servicio,
  c.fecha,
  c.hora_inicio,
  c.hora_fin,
  COUNT(*)        AS citas_en_slot,
  s.aforo_simultaneo_maximo
FROM public.servicios s
JOIN public.detalle_citas_servicios dcs ON dcs.servicio_id = s.id
JOIN public.citas c ON c.id = dcs.cita_id
WHERE c.estado NOT IN ('CANCELADA', 'NO_SHOW')
GROUP BY s.id, s.nombre, c.fecha, c.hora_inicio, c.hora_fin, s.aforo_simultaneo_maximo;

-- Comentario: consultar así desde el frontend (vía supabase.from)
-- SELECT * FROM v_disponibilidad_servicios
-- WHERE servicio_id = '<uuid>' AND fecha = '2026-09-20'
-- AND citas_en_slot >= aforo_simultaneo_maximo;
