-- Vincula el perfil interno con Supabase Auth y permite leer el perfil propio.
-- Ejecutar en Supabase SQL Editor sobre una base existente.

ALTER TABLE public."Usuario"
    ADD COLUMN IF NOT EXISTS auth_user_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Usuario_auth_user_id_fkey'
          AND conrelid = 'public."Usuario"'::regclass
    ) THEN
        ALTER TABLE public."Usuario"
            ADD CONSTRAINT "Usuario_auth_user_id_fkey"
            FOREIGN KEY (auth_user_id)
            REFERENCES auth.users(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_auth_user_id_key"
    ON public."Usuario" (auth_user_id)
    WHERE auth_user_id IS NOT NULL;

ALTER TABLE public."Usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Rol" ENABLE ROW LEVEL SECURITY;

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

-- RLS controla filas; estos permisos también protegen columnas sensibles.
REVOKE SELECT ON TABLE public."Usuario" FROM PUBLIC, anon, authenticated;
GRANT SELECT (
    "ID", "DNI", "Nombre", "Apellido", "E_mail", "Telefono", "Usuario",
    "Color_agenda", "Comision_porcentaje", "Rol_id", "Estado", auth_user_id
) ON TABLE public."Usuario" TO authenticated;

REVOKE SELECT ON TABLE public."Rol" FROM PUBLIC, anon, authenticated;
GRANT SELECT ("ID", "Nombre", "Estado")
    ON TABLE public."Rol" TO authenticated;

-- Después de ejecutar esta migración, vincula cada perfil con el UUID real
-- de auth.users. No se asocia automáticamente por email.
-- UPDATE public."Usuario"
-- SET auth_user_id = 'UUID_REAL_DE_AUTH'
-- WHERE "ID" = ID_DEL_PERFIL;
