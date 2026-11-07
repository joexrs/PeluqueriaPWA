-- =====================================================================
-- POLÍTICAS RLS (Supabase) - roles: admin, jefe, recepcionista, trabajador
-- Ejecutar DESPUÉS de schema.sql. Es re-ejecutable (borra y recrea las
-- políticas de cada tabla). No modifica datos ni la tabla Rol.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FUNCIONES AUXILIARES (schema privado, no expuesto por la API)
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- ID (tabla Usuario) de quien está logueado; null si no existe o está inactivo
create or replace function private.usuario_id_actual()
returns integer language sql stable security definer set search_path = ''
as $$
  select u."ID" from public."Usuario" u
  where u.auth_user_id = (select auth.uid()) and u."Estado" is true
  limit 1;
$$;

-- Nombre del rol (en minúsculas) de quien está logueado
create or replace function private.rol_actual()
returns text language sql stable security definer set search_path = ''
as $$
  select lower(r."Nombre")::text
  from public."Usuario" u
  join public."Rol" r on r."ID" = u."Rol_id"
  where u.auth_user_id = (select auth.uid())
    and u."Estado" is true and r."Estado" is true
  limit 1;
$$;

create or replace function private.tiene_rol(variadic roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(private.rol_actual() = any(roles), false);
$$;

-- Nombre del rol a partir de un Rol_id (para que 'jefe' solo gestione trabajadores)
create or replace function private.rol_de(p_rol_id integer)
returns text language sql stable security definer set search_path = ''
as $$
  select lower(r."Nombre")::text from public."Rol" r
  where r."ID" = p_rol_id and r."Estado" is true;
$$;

-- ¿El trabajador logueado está asignado a esta cita?
create or replace function private.es_mi_cita(p_cita_id integer)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public."Cita_Servicio" cs
    where cs.cita_id = p_cita_id
      and cs.trabajador_id = private.usuario_id_actual()
  );
$$;

-- ¿Este cliente tiene alguna cita con el trabajador logueado?
create or replace function private.es_mi_cliente(p_cliente_id integer)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public."Cita" c
    join public."Cita_Servicio" cs on cs.cita_id = c."ID"
    where c.cliente_id = p_cliente_id
      and cs.trabajador_id = private.usuario_id_actual()
  );
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.usuario_id_actual(), private.rol_actual(), private.tiene_rol(text[]),
  private.rol_de(integer), private.es_mi_cita(integer), private.es_mi_cliente(integer)
to authenticated;

-- ---------------------------------------------------------------------
-- 2. HELPER TEMPORAL: aplica la política por operación según roles
--    (se elimina al final del script)
-- ---------------------------------------------------------------------
create or replace function private.aplicar_politicas(
  p_tabla text, p_leer text[], p_crear text[], p_editar text[], p_borrar text[]
) returns void language plpgsql as $$
declare r record;
begin
  execute format('alter table public.%I enable row level security', p_tabla);

  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = p_tabla loop
    execute format('drop policy %I on public.%I', r.policyname, p_tabla);
  end loop;

  if coalesce(array_length(p_leer,1),0) > 0 then
    execute format($f$create policy "rls_leer" on public.%I for select to authenticated
      using ((select private.tiene_rol(variadic %L::text[])))$f$, p_tabla, p_leer);
  end if;
  if coalesce(array_length(p_crear,1),0) > 0 then
    execute format($f$create policy "rls_crear" on public.%I for insert to authenticated
      with check ((select private.tiene_rol(variadic %L::text[])))$f$, p_tabla, p_crear);
  end if;
  if coalesce(array_length(p_editar,1),0) > 0 then
    execute format($f$create policy "rls_editar" on public.%I for update to authenticated
      using ((select private.tiene_rol(variadic %L::text[])))
      with check ((select private.tiene_rol(variadic %L::text[])))$f$, p_tabla, p_editar, p_editar);
  end if;
  if coalesce(array_length(p_borrar,1),0) > 0 then
    execute format($f$create policy "rls_borrar" on public.%I for delete to authenticated
      using ((select private.tiene_rol(variadic %L::text[])))$f$, p_tabla, p_borrar);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. MATRIZ DE PERMISOS
--    (tabla, leer, crear, editar, borrar)
-- ---------------------------------------------------------------------

-- Seguridad / personal
select private.aplicar_politicas('Rol',     '{admin,jefe,recepcionista,trabajador}', '{admin}', '{admin}', '{admin}');
select private.aplicar_politicas('Usuario', '{admin,jefe,recepcionista}',            '{admin}', '{admin}', '{admin}');

-- Clientes
select private.aplicar_politicas('Cliente', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe}');

-- Productos / inventario (/productos: admin, jefe)
select private.aplicar_politicas('Categoria',   '{admin,jefe,recepcionista}', '{admin,jefe}', '{admin,jefe}', '{admin,jefe}');
select private.aplicar_politicas('Producto',    '{admin,jefe,recepcionista}', '{admin,jefe}', '{admin,jefe}', '{admin,jefe}');
select private.aplicar_politicas('Lote',        '{admin,jefe}',               '{admin,jefe}', '{admin,jefe}', '{admin}');
select private.aplicar_politicas('Movimientos', '{admin,jefe}',               '{admin,jefe}', '{admin}',      '{admin}');

-- Servicios y trabajadores (/servicios, /trabajadores: admin, jefe)
select private.aplicar_politicas('Categoria_Servicio',  '{admin,jefe,recepcionista,trabajador}', '{admin,jefe}', '{admin,jefe}', '{admin,jefe}');
select private.aplicar_politicas('Servicio',            '{admin,jefe,recepcionista,trabajador}', '{admin,jefe}', '{admin,jefe}', '{admin,jefe}');
select private.aplicar_politicas('Trabajador_Servicio', '{admin,jefe,recepcionista,trabajador}', '{admin,jefe}', '{admin,jefe}', '{admin,jefe}');

-- Promociones (recepcionista solo lectura, para aplicarlas en ventas)
select private.aplicar_politicas('Promocion', '{admin,jefe,recepcionista}', '{admin,jefe}', '{admin,jefe}', '{admin,jefe}');

-- Citas (trabajador: solo lectura de las suyas, se agrega abajo)
select private.aplicar_politicas('Cita',          '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe}');
select private.aplicar_politicas('Cita_Servicio', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe}');

-- Ventas (solo admin puede borrar: son registros contables)
select private.aplicar_politicas('Venta',         '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin}');
select private.aplicar_politicas('Venta_Detalle', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin,jefe,recepcionista}', '{admin}');

-- ---------------------------------------------------------------------
-- 4. POLÍTICAS ESPECIALES (se suman con OR a las anteriores)
-- ---------------------------------------------------------------------

-- Todos pueden leer su propio perfil
create policy "rls_leer_propio" on public."Usuario"
  for select to authenticated
  using ( auth_user_id = (select auth.uid()) );

-- 'jefe' puede crear y editar SOLO usuarios con rol 'trabajador'
create policy "rls_jefe_crea_trabajadores" on public."Usuario"
  for insert to authenticated
  with check ( (select private.tiene_rol('jefe')) and private.rol_de("Rol_id") = 'trabajador' );

create policy "rls_jefe_edita_trabajadores" on public."Usuario"
  for update to authenticated
  using      ( (select private.tiene_rol('jefe')) and private.rol_de("Rol_id") = 'trabajador' )
  with check ( (select private.tiene_rol('jefe')) and private.rol_de("Rol_id") = 'trabajador' );

-- 'jefe' puede ver a todos los usuarios (ya incluido en rls_leer) y 'trabajador'
-- puede leer los clientes de sus citas (para ver quién viene en su agenda)
create policy "rls_trabajador_lee_sus_clientes" on public."Cliente"
  for select to authenticated
  using ( private.es_mi_cliente("ID") );

-- 'trabajador' lee solo sus citas
create policy "rls_trabajador_lee_sus_citas" on public."Cita"
  for select to authenticated
  using ( private.es_mi_cita("ID") );

create policy "rls_trabajador_lee_sus_servicios" on public."Cita_Servicio"
  for select to authenticated
  using ( trabajador_id = private.usuario_id_actual() );

-- ---------------------------------------------------------------------
-- 5. CORRECCIÓN DE TRIGGERS DE SOLAPE DE CITAS
--    validar_solape_cita() tiene EXECUTE revocado a 'authenticated', así que
--    los triggers (que corren como el usuario) fallarían con "permission
--    denied". Se ejecutan como owner (SECURITY DEFINER), y además ven TODAS
--    las citas para detectar cruces reales entre trabajadores.
-- ---------------------------------------------------------------------
alter function public.tr_fn_solape_cita_servicio() security definer;
alter function public.tr_fn_solape_cita()          security definer;

-- ---------------------------------------------------------------------
-- 6. ENDURECIMIENTO FINAL
-- ---------------------------------------------------------------------
-- 'anon' no necesita tocar ninguna tabla (el login va por Supabase Auth)
revoke all on all tables in schema public from anon;

-- El helper ya no hace falta
drop function private.aplicar_politicas(text, text[], text[], text[], text[]);

-- Índices usados por las políticas (si no existen)
create index if not exists idx_usuario_auth_user_id on public."Usuario"(auth_user_id);

-- Verificación:  select tablename, policyname, cmd from pg_policies
--                where schemaname = 'public' order by 1, 3;