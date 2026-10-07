-- =====================================================================
-- BASE DE DATOS: Peluquería (Víctor Manuel Peluqueros)
-- Versión corregida y adaptada para SUPABASE (PostgreSQL 15+)
-- Ejecutar completo en: Supabase > SQL Editor (sobre una BD limpia)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- En Supabase, pgcrypto vive en el esquema "extensions" (no en public).
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- (OPCIONAL) RESET: descomenta SOLO si quieres borrar todo y recrear.
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS "Venta_Detalle", "Venta", "Promocion", "Cita_Servicio",
--   "Cita", "Trabajador_Servicio", "Servicio", "Categoria_Servicio",
--   "Movimientos", "Lote", "Producto", "Categoria", "Cliente", "Usuario", "Rol" CASCADE;

-- =====================================================================
-- 1. TABLA: Rol
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Rol" (
    "ID"         SERIAL PRIMARY KEY,
    "Nombre"     VARCHAR(50) NOT NULL UNIQUE,
    "Estado"     BOOLEAN DEFAULT TRUE,
    "Created_at" TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at" TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO "Rol" ("Nombre", "Estado") VALUES
    ('admin', TRUE),
    ('jefe', TRUE),
    ('recepcionista', TRUE),
    ('trabajador', TRUE)
ON CONFLICT ("Nombre") DO NOTHING;

-- =====================================================================
-- 2. TABLA: Usuario
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Usuario" (
    "ID"                  SERIAL PRIMARY KEY,
    "DNI"                 VARCHAR(20) UNIQUE,
    "Nombre"              VARCHAR(100) NOT NULL,
    "Apellido"            VARCHAR(100) NOT NULL,
    "E_mail"              VARCHAR(150) UNIQUE NOT NULL,
    "Telefono"            VARCHAR(20),
    "Usuario"             VARCHAR(50) UNIQUE NOT NULL,   -- nombre de usuario para login
    "Contraseña"          VARCHAR(255) NOT NULL,         -- se guarda el hash bcrypt
    "Color_agenda"        VARCHAR(7),                    -- hex (#RRGGBB); obligatorio solo para 'trabajador'
    "Comision_porcentaje" DECIMAL(5,2),                  -- obligatorio solo para 'trabajador'
    "Rol_id"              INTEGER,
    "Estado"              BOOLEAN DEFAULT TRUE,
    auth_user_id          UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    "Created_at"          TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_Usuario_Rol" FOREIGN KEY ("Rol_id") REFERENCES "Rol"("ID") ON DELETE SET NULL,
    CONSTRAINT "CK_Usuario_Color" CHECK ("Color_agenda" IS NULL OR "Color_agenda" ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT "CK_Usuario_Comision" CHECK ("Comision_porcentaje" IS NULL OR "Comision_porcentaje" BETWEEN 0 AND 100)
);

-- ---------------------------------------------------------------------
-- Trigger: hashear contraseña
-- CORRECCIÓN: antes se re-hasheaba en CADA update (incluso al cambiar solo
-- el Estado), dejando la contraseña inservible. Ahora solo hashea en INSERT
-- o cuando la contraseña realmente cambia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_password_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW."Contraseña" IS DISTINCT FROM OLD."Contraseña" THEN
        NEW."Contraseña" := crypt(NEW."Contraseña", gen_salt('bf'));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_hash_password ON "Usuario";
CREATE TRIGGER tr_hash_password
BEFORE INSERT OR UPDATE ON "Usuario"
FOR EACH ROW
EXECUTE FUNCTION public.hash_password_trigger();

-- ---------------------------------------------------------------------
-- Trigger: validar campos condicionales por rol
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_campos_trabajador()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_es_trabajador BOOLEAN := FALSE;
BEGIN
    IF NEW."Rol_id" IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM "Rol"
            WHERE "ID" = NEW."Rol_id" AND LOWER("Nombre") = 'trabajador'
        ) INTO v_es_trabajador;
    END IF;

    IF v_es_trabajador THEN
        IF NEW."Color_agenda" IS NULL OR TRIM(NEW."Color_agenda") = '' THEN
            RAISE EXCEPTION 'Color_agenda es OBLIGATORIO para el rol trabajador.'
                USING ERRCODE = 'not_null_violation';
        END IF;
        IF NEW."Comision_porcentaje" IS NULL THEN
            RAISE EXCEPTION 'Comision_porcentaje es OBLIGATORIO para el rol trabajador.'
                USING ERRCODE = 'not_null_violation';
        END IF;
    ELSE
        IF NEW."Color_agenda" IS NULL OR TRIM(NEW."Color_agenda") = '' THEN
            NEW."Color_agenda" := '#000000';
        END IF;
        IF NEW."Comision_porcentaje" IS NULL THEN
            NEW."Comision_porcentaje" := 0.00;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_campos_trabajador ON "Usuario";
CREATE TRIGGER tr_validar_campos_trabajador
BEFORE INSERT OR UPDATE ON "Usuario"
FOR EACH ROW
EXECUTE FUNCTION public.validar_campos_trabajador();

-- ---------------------------------------------------------------------
-- Función de login (opcional): verifica usuario/contraseña contra el hash.
-- Solo ejecutable por service_role (tu backend / bot), NUNCA por anon.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verificar_credenciales(p_usuario TEXT, p_password TEXT)
RETURNS TABLE (id INTEGER, nombre VARCHAR, apellido VARCHAR, rol VARCHAR)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
    SELECT u."ID", u."Nombre", u."Apellido", r."Nombre"
    FROM "Usuario" u
    LEFT JOIN "Rol" r ON r."ID" = u."Rol_id"
    WHERE u."Usuario" = p_usuario
      AND u."Estado" = TRUE
      AND u."Contraseña" = crypt(p_password, u."Contraseña");
$$;

REVOKE ALL ON FUNCTION public.verificar_credenciales(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_credenciales(TEXT, TEXT) TO service_role;

-- =====================================================================
-- 3. TABLA: Cliente
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Cliente" (
    "ID"               SERIAL PRIMARY KEY,
    "Nombre"           VARCHAR(100) NOT NULL,
    "Apellido"         VARCHAR(100) NOT NULL,
    "Telefono"         VARCHAR(20),
    "E_mail"           VARCHAR(150),
    "DNI"              VARCHAR(20) UNIQUE,
    "Fecha_Nacimiento" DATE,
    "Total_visitas"    INTEGER DEFAULT 0 CHECK ("Total_visitas" >= 0),
    "Preferencias"     JSONB,
    "Estado"           BOOLEAN DEFAULT TRUE,
    "Created_at"       TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"       TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 4. TABLA: Categoria (de productos)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Categoria" (
    "ID"         SERIAL PRIMARY KEY,
    "Nombre"     VARCHAR(50) NOT NULL UNIQUE,
    "Estado"     BOOLEAN DEFAULT TRUE,
    "Created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 5. TABLA: Producto
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Producto" (
    "ID"           SERIAL PRIMARY KEY,
    "Nombre"       VARCHAR(100) NOT NULL,
    "Descripcion"  TEXT,
    "Marca"        VARCHAR(100),
    "Stock_total"  INTEGER DEFAULT 0 CHECK ("Stock_total" >= 0),
    "Codigo"       VARCHAR(50) UNIQUE,
    "Precio"       DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK ("Precio" >= 0),
    "Categoria_id" INTEGER,
    "Estado"       BOOLEAN DEFAULT TRUE,
    "Created_at"   TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_Producto_Categoria" FOREIGN KEY ("Categoria_id") REFERENCES "Categoria"("ID") ON DELETE SET NULL
);

-- =====================================================================
-- 6. TABLA: Lote
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Lote" (
    "ID"                SERIAL PRIMARY KEY,
    "Fecha_vencimiento" DATE NOT NULL,
    "Fecha_ingreso"     DATE NOT NULL DEFAULT CURRENT_DATE,
    "Cantidad"          INTEGER NOT NULL DEFAULT 1 CHECK ("Cantidad" >= 0),
    "Producto_id"       INTEGER NOT NULL,
    "Estado"            BOOLEAN DEFAULT TRUE,
    "Created_at"        TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"        TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_Lote_Producto" FOREIGN KEY ("Producto_id") REFERENCES "Producto"("ID") ON DELETE CASCADE,
    CONSTRAINT "CK_Lote_Fechas" CHECK ("Fecha_vencimiento" >= "Fecha_ingreso"),
    -- Necesario para la FK compuesta de Movimientos (lote y producto coherentes)
    CONSTRAINT "UC_Lote_ID_Producto" UNIQUE ("ID", "Producto_id")
);

-- =====================================================================
-- 7. TABLA: Movimientos
-- CORRECCIÓN: la FK compuesta garantiza que el lote pertenezca al producto
-- indicado (antes se podía registrar un movimiento con lote de otro producto).
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Movimientos" (
    "ID"               SERIAL PRIMARY KEY,
    "Cantidad"         INTEGER NOT NULL CHECK ("Cantidad" > 0),
    "Tipo"             VARCHAR(10) NOT NULL CHECK ("Tipo" IN ('Entrada', 'Salida')),
    "Fecha_movimiento" TIMESTAMPTZ DEFAULT NOW(),
    "Lote_id"          INTEGER NOT NULL,
    "Producto_id"      INTEGER NOT NULL,
    "Estado"           BOOLEAN DEFAULT TRUE,
    "Created_at"       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_Movimientos_Lote_Producto" FOREIGN KEY ("Lote_id", "Producto_id")
        REFERENCES "Lote"("ID", "Producto_id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Movimientos_Producto" FOREIGN KEY ("Producto_id")
        REFERENCES "Producto"("ID") ON DELETE RESTRICT
);

-- =====================================================================
-- 8. TABLA: Categoria_Servicio
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Categoria_Servicio" (
    "ID"          SERIAL PRIMARY KEY,
    "Nombre"      VARCHAR(50) NOT NULL UNIQUE,
    "Descripcion" TEXT,
    "Estado"      BOOLEAN DEFAULT TRUE,
    "Created_at"  TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 9. TABLA: Servicio
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Servicio" (
    "ID"               SERIAL PRIMARY KEY,
    "Nombre"           VARCHAR(100) NOT NULL UNIQUE,
    "Descripcion"      TEXT,
    "Precio"           DECIMAL(10,2) NOT NULL CHECK ("Precio" >= 0),
    "Duracion_minutos" INTEGER NOT NULL DEFAULT 30 CHECK ("Duracion_minutos" > 0),
    "Categoria_id"     INTEGER,
    "Estado"           BOOLEAN DEFAULT TRUE,
    "Created_at"       TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_Servicio_Categoria" FOREIGN KEY ("Categoria_id") REFERENCES "Categoria_Servicio"("ID") ON DELETE SET NULL
);

-- =====================================================================
-- 10. TABLA: Trabajador_Servicio
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Trabajador_Servicio" (
    "ID"          SERIAL PRIMARY KEY,
    "usuario_id"  INTEGER NOT NULL,
    "Servicio_id" INTEGER NOT NULL,
    "Estado"      BOOLEAN DEFAULT TRUE,
    "Created_at"  TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_TrabajadorServicio_Usuario" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("ID") ON DELETE CASCADE,
    CONSTRAINT "FK_TrabajadorServicio_Servicio" FOREIGN KEY ("Servicio_id") REFERENCES "Servicio"("ID") ON DELETE CASCADE,
    CONSTRAINT "UC_Trabajador_Servicio" UNIQUE ("usuario_id", "Servicio_id")
);

-- =====================================================================
-- 11. TABLA: Cita
-- CORRECCIÓN: faltaba la FK a Cliente y el CHECK hora_fin > hora_inicio.
-- Nota: "Estado" = FALSE se interpreta como cita anulada/cancelada.
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Cita" (
    "ID"          SERIAL PRIMARY KEY,
    "cliente_id"  INTEGER NOT NULL,
    "fecha_cita"  DATE NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fin"    TIME NOT NULL,
    "Estado"      BOOLEAN DEFAULT TRUE,
    "Created_at"  TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_Cita_Cliente" FOREIGN KEY ("cliente_id") REFERENCES "Cliente"("ID") ON DELETE RESTRICT,
    CONSTRAINT "CK_Cita_Horas" CHECK ("hora_fin" > "hora_inicio")
);

-- =====================================================================
-- 12. TABLA: Cita_Servicio
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Cita_Servicio" (
    "ID"            SERIAL PRIMARY KEY,
    "cita_id"       INTEGER NOT NULL,
    "servicio_id"   INTEGER NOT NULL,
    "trabajador_id" INTEGER NOT NULL,
    "orden"         INTEGER DEFAULT 1 CHECK ("orden" >= 1),
    "Cantidad"      INTEGER DEFAULT 1 CHECK ("Cantidad" > 0),
    CONSTRAINT "FK_CitaServ_Cita" FOREIGN KEY ("cita_id") REFERENCES "Cita"("ID") ON DELETE CASCADE,
    CONSTRAINT "FK_CitaServ_Servicio" FOREIGN KEY ("servicio_id") REFERENCES "Servicio"("ID") ON DELETE RESTRICT,
    -- Garantiza que el trabajador esté habilitado para ese servicio
    CONSTRAINT "FK_CitaServ_Trabajador_Servicio" FOREIGN KEY ("trabajador_id", "servicio_id")
        REFERENCES "Trabajador_Servicio"("usuario_id", "Servicio_id")
);

-- =====================================================================
-- 13. TABLA: Venta
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Venta" (
    "ID"           SERIAL PRIMARY KEY,
    "Cliente_ID"   INTEGER NOT NULL,
    "Usuario_ID"   INTEGER NOT NULL,
    "Fecha_Venta"  TIMESTAMPTZ DEFAULT NOW(),
    "Total"        DECIMAL(10,2) DEFAULT 0.00,   -- lo mantiene el trigger a partir del detalle
    "Cita_ID"      INTEGER,
    "Metodo_Pago"  VARCHAR(50),
    "Estado_Venta" VARCHAR(20) DEFAULT 'Pendiente' CHECK ("Estado_Venta" IN ('Pendiente', 'Pagado', 'Cancelado')),
    CONSTRAINT "FK_Venta_Cliente" FOREIGN KEY ("Cliente_ID") REFERENCES "Cliente"("ID") ON DELETE RESTRICT,
    CONSTRAINT "FK_Venta_Usuario" FOREIGN KEY ("Usuario_ID") REFERENCES "Usuario"("ID") ON DELETE RESTRICT,
    CONSTRAINT "FK_Venta_Cita" FOREIGN KEY ("Cita_ID") REFERENCES "Cita"("ID") ON DELETE SET NULL
);

-- =====================================================================
-- 14. TABLA: Venta_Detalle
-- CORRECCIONES:
--  * Estado_Detalle ahora admite 'Pagado' (antes el trigger lo buscaba pero el
--    CHECK no lo permitía, así que una venta nunca podía quedar 'Pagado').
--  * FK a Servicio/Producto con RESTRICT: con SET NULL, borrar un servicio o
--    producto dejaba ambos campos en NULL y violaba CK_Venta_Detalle_Tipo.
--    Para "retirar" un servicio/producto usa Estado = FALSE.
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Venta_Detalle" (
    "ID"              SERIAL PRIMARY KEY,
    "Venta_ID"        INTEGER NOT NULL,
    "Servicio_ID"     INTEGER,
    "Producto_ID"     INTEGER,
    "Cantidad"        INTEGER NOT NULL DEFAULT 1 CHECK ("Cantidad" > 0),
    "Precio_Unitario" DECIMAL(10,2) NOT NULL CHECK ("Precio_Unitario" >= 0),
    "Subtotal"        DECIMAL(10,2) GENERATED ALWAYS AS ("Cantidad" * "Precio_Unitario") STORED,
    "Estado_Detalle"  VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                      CHECK ("Estado_Detalle" IN ('Pendiente', 'Pagado', 'Cancelado')),
    CONSTRAINT "CK_Venta_Detalle_Tipo" CHECK (
        ("Servicio_ID" IS NOT NULL AND "Producto_ID" IS NULL) OR
        ("Servicio_ID" IS NULL AND "Producto_ID" IS NOT NULL)
    ),
    CONSTRAINT "FK_VentaDet_Venta" FOREIGN KEY ("Venta_ID") REFERENCES "Venta"("ID") ON DELETE CASCADE,
    CONSTRAINT "FK_VentaDet_Servicio" FOREIGN KEY ("Servicio_ID") REFERENCES "Servicio"("ID") ON DELETE RESTRICT,
    CONSTRAINT "FK_VentaDet_Producto" FOREIGN KEY ("Producto_ID") REFERENCES "Producto"("ID") ON DELETE RESTRICT
);

-- =====================================================================
-- 15. TABLA: Promocion
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Promocion" (
    "ID"                   SERIAL PRIMARY KEY,
    "Nombre"               VARCHAR(100),
    "Descripcion"          TEXT,
    "Porcentaje_Descuento" DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK ("Porcentaje_Descuento" BETWEEN 0 AND 100),
    "Fecha_Inicio"         DATE NOT NULL,
    "Fecha_Fin"            DATE NOT NULL,
    "Servicio_ID"          INTEGER,
    "Estado"               BOOLEAN DEFAULT TRUE,
    "Created_at"           TIMESTAMPTZ DEFAULT NOW(),
    "Updated_at"           TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "FK_Promocion_Servicio" FOREIGN KEY ("Servicio_ID") REFERENCES "Servicio"("ID") ON DELETE SET NULL,
    CONSTRAINT "CK_Promocion_Fechas" CHECK ("Fecha_Fin" >= "Fecha_Inicio")
);

-- =====================================================================
-- 16. TRIGGER: Validación de horario de citas
-- Lunes a Sábado: 10:30 a 21:00 | Domingo: 11:00 a 18:00
-- CORRECCIÓN: el original usaba sintaxis de MySQL (DECLARE tras BEGIN y
-- SET x = ...), que no existe en PL/pgSQL y fallaba al crear la función.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.chk_validar_horario_cita()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_dow       INT;
    v_apertura  TIME;
    v_cierre    TIME;
    v_dia       TEXT;
BEGIN
    v_dow := EXTRACT(DOW FROM NEW.fecha_cita)::INT;   -- 0 = domingo ... 6 = sábado

    IF v_dow BETWEEN 1 AND 6 THEN
        v_apertura := '10:30:00'; v_cierre := '21:00:00'; v_dia := 'lunes a sábado';
    ELSE
        v_apertura := '11:00:00'; v_cierre := '18:00:00'; v_dia := 'domingo';
    END IF;

    IF NEW.hora_inicio < v_apertura THEN
        RAISE EXCEPTION 'La hora de inicio no puede ser antes de las % (%).', v_apertura, v_dia
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.hora_fin > v_cierre THEN
        RAISE EXCEPTION 'La hora de fin no puede ser después de las % (%).', v_cierre, v_dia
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_horario_cita ON "Cita";
CREATE TRIGGER tr_validar_horario_cita
BEFORE INSERT OR UPDATE ON "Cita"
FOR EACH ROW
EXECUTE FUNCTION public.chk_validar_horario_cita();

-- =====================================================================
-- 17. TRIGGER: Actualización automática de estado y total de la venta
-- CORRECCIONES respecto al original:
--  * Era AFTER sobre Venta_Detalle pero asignaba NEW."Estado_Venta" (columna que
--    no existe en Venta_Detalle) -> error. Ahora hace UPDATE sobre "Venta".
--  * En DELETE, NEW es NULL: ahora se usa OLD.
--  * Buscaba 'Pagado' en un CHECK que no lo permitía (ya corregido arriba).
--  * Ahora una venta con líneas canceladas y el resto pagadas queda 'Pagado'.
--  * Recalcula "Total" (suma de líneas no canceladas).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.actualizar_estado_venta()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_ids         INTEGER[];
    v_venta_id    INTEGER;
    v_total_lin   INTEGER;
    v_cancelados  INTEGER;
    v_pagados     INTEGER;
    v_total       DECIMAL(10,2);
    v_nuevo       VARCHAR(20);
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
               COALESCE(SUM("Subtotal") FILTER (WHERE "Estado_Detalle" <> 'Cancelado'), 0)
          INTO v_total_lin, v_cancelados, v_pagados, v_total
          FROM "Venta_Detalle"
         WHERE "Venta_ID" = v_venta_id;

        IF v_total_lin = 0 THEN
            v_nuevo := 'Pendiente';
        ELSIF v_cancelados = v_total_lin THEN
            v_nuevo := 'Cancelado';
        ELSIF v_pagados = v_total_lin - v_cancelados THEN
            v_nuevo := 'Pagado';
        ELSE
            v_nuevo := 'Pendiente';
        END IF;

        UPDATE "Venta"
           SET "Estado_Venta" = v_nuevo,
               "Total"        = v_total
         WHERE "ID" = v_venta_id
           AND ("Estado_Venta" IS DISTINCT FROM v_nuevo OR "Total" IS DISTINCT FROM v_total);
    END LOOP;

    RETURN NULL;   -- trigger AFTER: el valor de retorno se ignora
END;
$$;

DROP TRIGGER IF EXISTS tr_actualizar_estado_venta ON "Venta_Detalle";
CREATE TRIGGER tr_actualizar_estado_venta
AFTER INSERT OR UPDATE OR DELETE ON "Venta_Detalle"
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_estado_venta();

-- =====================================================================
-- 18. TRIGGER NUEVO: evitar doble reserva de un trabajador
-- Un trabajador no puede tener dos citas activas que se solapen el mismo día.
-- (Valida al agregar/cambiar servicios de la cita y al cambiar fecha/horas.)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validar_solape_cita(p_cita_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_trabajador INTEGER;
BEGIN
    SELECT cs2.trabajador_id
      INTO v_trabajador
      FROM "Cita" c1
      JOIN "Cita_Servicio" cs1 ON cs1.cita_id = c1."ID"
      JOIN "Cita_Servicio" cs2 ON cs2.trabajador_id = cs1.trabajador_id
                              AND cs2.cita_id <> c1."ID"
      JOIN "Cita" c2 ON c2."ID" = cs2.cita_id
     WHERE c1."ID" = p_cita_id
       AND c1."Estado" = TRUE
       AND c2."Estado" = TRUE
       AND c2.fecha_cita = c1.fecha_cita
       AND c2.hora_inicio < c1.hora_fin
       AND c2.hora_fin    > c1.hora_inicio
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'El trabajador % ya tiene otra cita que se cruza en ese horario.', v_trabajador
            USING ERRCODE = 'exclusion_violation';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_solape_cita(INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tr_fn_solape_cita_servicio()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    PERFORM public.validar_solape_cita(NEW.cita_id);
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tr_fn_solape_cita()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    PERFORM public.validar_solape_cita(NEW."ID");
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_solape_cita_servicio ON "Cita_Servicio";
CREATE TRIGGER tr_solape_cita_servicio
AFTER INSERT OR UPDATE OF cita_id, trabajador_id ON "Cita_Servicio"
FOR EACH ROW EXECUTE FUNCTION public.tr_fn_solape_cita_servicio();

DROP TRIGGER IF EXISTS tr_solape_cita ON "Cita";
CREATE TRIGGER tr_solape_cita
AFTER UPDATE OF fecha_cita, hora_inicio, hora_fin, "Estado" ON "Cita"
FOR EACH ROW EXECUTE FUNCTION public.tr_fn_solape_cita();

-- =====================================================================
-- 19. TRIGGER GENÉRICO: mantener "Updated_at"
-- (en el original la columna existía pero nunca se actualizaba)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW."Updated_at" := NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT c.table_name
          FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.column_name = 'Updated_at'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_set_updated_at ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    END LOOP;
END;
$$;

-- =====================================================================
-- 20. ÍNDICES (Postgres NO indexa las FK automáticamente)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_usuario_rol            ON "Usuario"("Rol_id");
CREATE INDEX IF NOT EXISTS idx_cliente_telefono       ON "Cliente"("Telefono");   -- búsquedas del bot de WhatsApp
CREATE INDEX IF NOT EXISTS idx_producto_categoria     ON "Producto"("Categoria_id");
CREATE INDEX IF NOT EXISTS idx_lote_producto          ON "Lote"("Producto_id");
CREATE INDEX IF NOT EXISTS idx_lote_vencimiento       ON "Lote"("Fecha_vencimiento");
CREATE INDEX IF NOT EXISTS idx_movimientos_lote       ON "Movimientos"("Lote_id");
CREATE INDEX IF NOT EXISTS idx_movimientos_producto   ON "Movimientos"("Producto_id");
CREATE INDEX IF NOT EXISTS idx_servicio_categoria     ON "Servicio"("Categoria_id");
CREATE INDEX IF NOT EXISTS idx_trabserv_servicio      ON "Trabajador_Servicio"("Servicio_id");
CREATE INDEX IF NOT EXISTS idx_cita_cliente           ON "Cita"("cliente_id");
CREATE INDEX IF NOT EXISTS idx_cita_fecha             ON "Cita"("fecha_cita");
CREATE INDEX IF NOT EXISTS idx_citaserv_cita          ON "Cita_Servicio"("cita_id");
CREATE INDEX IF NOT EXISTS idx_citaserv_trabajador    ON "Cita_Servicio"("trabajador_id", "servicio_id");
CREATE INDEX IF NOT EXISTS idx_citaserv_servicio      ON "Cita_Servicio"("servicio_id");
CREATE INDEX IF NOT EXISTS idx_venta_cliente          ON "Venta"("Cliente_ID");
CREATE INDEX IF NOT EXISTS idx_venta_usuario          ON "Venta"("Usuario_ID");
CREATE INDEX IF NOT EXISTS idx_venta_cita             ON "Venta"("Cita_ID");
CREATE INDEX IF NOT EXISTS idx_venta_fecha            ON "Venta"("Fecha_Venta");
CREATE INDEX IF NOT EXISTS idx_ventadet_venta         ON "Venta_Detalle"("Venta_ID");
CREATE INDEX IF NOT EXISTS idx_ventadet_servicio      ON "Venta_Detalle"("Servicio_ID");
CREATE INDEX IF NOT EXISTS idx_ventadet_producto      ON "Venta_Detalle"("Producto_ID");
CREATE INDEX IF NOT EXISTS idx_promocion_servicio     ON "Promocion"("Servicio_ID");
CREATE INDEX IF NOT EXISTS idx_promocion_fechas       ON "Promocion"("Fecha_Inicio", "Fecha_Fin");

-- =====================================================================
-- 21. SEGURIDAD SUPABASE: Row Level Security
-- Supabase expone el esquema public por API (PostgREST). Sin RLS, cualquiera
-- con la anon key podría leer/escribir TODO (incluida la tabla Usuario).
-- Con RLS activado y SIN políticas, solo el service_role (tu backend/bot,
-- que ignora RLS) puede acceder. La política de perfil permite a cada usuario
-- autenticado leer solo su propio Usuario y el Rol asociado.
-- =====================================================================
ALTER TABLE "Rol"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cliente"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Categoria"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Producto"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lote"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Movimientos"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Categoria_Servicio"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Servicio"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trabajador_Servicio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cita"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cita_Servicio"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Venta"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Venta_Detalle"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promocion"           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_lee_su_perfil" ON public."Usuario";
CREATE POLICY "usuario_lee_su_perfil" ON public."Usuario"
    FOR SELECT TO authenticated
    USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "rol_lee_rol_de_su_perfil" ON public."Rol";
CREATE POLICY "rol_lee_rol_de_su_perfil" ON public."Rol"
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public."Usuario" AS u
            WHERE u."Rol_id" = "Rol"."ID"
              AND u.auth_user_id = (SELECT auth.uid())
        )
    );

-- Evita exponer la columna "Contraseña" (hash) mediante la API. El frontend
-- solo recibe las columnas que necesita para cargar el perfil y su rol.
REVOKE SELECT ON TABLE public."Usuario" FROM PUBLIC, anon, authenticated;
GRANT SELECT (
    "ID", "DNI", "Nombre", "Apellido", "E_mail", "Telefono", "Usuario",
    "Color_agenda", "Comision_porcentaje", "Rol_id", "Estado", auth_user_id
) ON TABLE public."Usuario" TO authenticated;
REVOKE SELECT ON TABLE public."Rol" FROM PUBLIC, anon, authenticated;
GRANT SELECT ("ID", "Nombre", "Estado")
    ON TABLE public."Rol" TO authenticated;

-- =====================================================================
-- 22. FUNCIÓN: registrar cita (crea el cliente si es nuevo)
-- Flujo: cliente (si no existe) -> cita -> detalle de servicios.
-- Todo en UNA transacción: si falla el horario, un cruce de trabajador o
-- cualquier validación, se deshace también el alta del cliente.
--
-- p_servicios: JSON, ej. [{"servicio_id":1,"trabajador_id":2,"orden":1}]
-- p_hora_fin : opcional; si es NULL se calcula con la duración de los servicios.
-- Búsqueda del cliente: por DNI si se envía; si no, por teléfono + nombre + apellido.
-- Uso (backend/bot con service_role):
--   SELECT * FROM registrar_cita_cliente('Juan','Perez','999111222',NULL,
--          '2026-10-08','15:00',NULL,'[{"servicio_id":1,"trabajador_id":1}]');
-- =====================================================================
CREATE OR REPLACE FUNCTION public.registrar_cita_cliente(
    p_nombre      TEXT,
    p_apellido    TEXT,
    p_telefono    TEXT,
    p_dni         TEXT,
    p_fecha       DATE,
    p_hora_inicio TIME,
    p_hora_fin    TIME,
    p_servicios   JSONB
)
RETURNS TABLE (out_cliente_id INTEGER, out_cita_id INTEGER, out_cliente_nuevo BOOLEAN)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_cliente_id INTEGER;
    v_nuevo      BOOLEAN := FALSE;
    v_cita_id    INTEGER;
    v_hora_fin   TIME := p_hora_fin;
    v_minutos    INTEGER;
    v_item       JSONB;
BEGIN
    IF p_servicios IS NULL OR jsonb_typeof(p_servicios) <> 'array' OR jsonb_array_length(p_servicios) = 0 THEN
        RAISE EXCEPTION 'Debes indicar al menos un servicio.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- 1. Cliente: buscar o crear
    IF NULLIF(TRIM(p_dni), '') IS NOT NULL THEN
        SELECT "ID" INTO v_cliente_id FROM "Cliente" WHERE "DNI" = TRIM(p_dni);
    ELSE
        SELECT "ID" INTO v_cliente_id FROM "Cliente"
         WHERE "Telefono" = p_telefono
           AND LOWER("Nombre") = LOWER(TRIM(p_nombre))
           AND LOWER("Apellido") = LOWER(TRIM(p_apellido))
         LIMIT 1;
    END IF;

    IF v_cliente_id IS NULL THEN
        INSERT INTO "Cliente" ("Nombre", "Apellido", "Telefono", "DNI")
        VALUES (TRIM(p_nombre), TRIM(p_apellido), p_telefono, NULLIF(TRIM(p_dni), ''))
        RETURNING "ID" INTO v_cliente_id;
        v_nuevo := TRUE;
    END IF;

    -- 2. Hora de fin: si no viene, suma de duraciones de los servicios
    IF v_hora_fin IS NULL THEN
        SELECT COALESCE(SUM(s."Duracion_minutos" * COALESCE((i->>'cantidad')::INT, 1)), 0)
          INTO v_minutos
          FROM jsonb_array_elements(p_servicios) i
          JOIN "Servicio" s ON s."ID" = (i->>'servicio_id')::INT;
        v_hora_fin := p_hora_inicio + make_interval(mins => v_minutos);
    END IF;

    -- 3. Cita (los triggers validan horario de atención)
    INSERT INTO "Cita" (cliente_id, fecha_cita, hora_inicio, hora_fin)
    VALUES (v_cliente_id, p_fecha, p_hora_inicio, v_hora_fin)
    RETURNING "ID" INTO v_cita_id;

    -- 4. Detalle (los triggers validan trabajador habilitado y cruces)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_servicios) LOOP
        INSERT INTO "Cita_Servicio" (cita_id, servicio_id, trabajador_id, orden, "Cantidad")
        VALUES (v_cita_id,
                (v_item->>'servicio_id')::INT,
                (v_item->>'trabajador_id')::INT,
                COALESCE((v_item->>'orden')::INT, 1),
                COALESCE((v_item->>'cantidad')::INT, 1));
    END LOOP;

    RETURN QUERY SELECT v_cliente_id, v_cita_id, v_nuevo;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_cita_cliente(TEXT,TEXT,TEXT,TEXT,DATE,TIME,TIME,JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_cita_cliente(TEXT,TEXT,TEXT,TEXT,DATE,TIME,TIME,JSONB)
    TO service_role;

-- =====================================================================
-- FIN DEL SCRIPT
-- =====================================================================