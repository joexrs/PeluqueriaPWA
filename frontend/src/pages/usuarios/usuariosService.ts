/**
 * usuariosService.ts — acceso directo a la tabla real de usuarios de Supabase.
 */
import { supabase } from "../../lib/supabaseClient";

export type RolUsuario = "admin" | "trabajador" | "recepcionista";

export interface UsuarioRow {
  id: string;
  auth_id?: string | null;
  dni?: string | null;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  rol: RolUsuario;
  color_agenda?: string | null;
  comision_porcentaje?: number | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CrearUsuarioPayload {
  nombre: string;
  apellido: string;
  email: string;
  dni?: string | null;
  telefono?: string | null;
  rol: RolUsuario;
  color_agenda?: string | null;
  comision_porcentaje?: number | null;
  activo: boolean;
}

function mapUsuario(row: Record<string, unknown>): UsuarioRow {
  const valorRol = typeof row.rol === "string" ? (row.rol as RolUsuario) : "trabajador";

  return {
    id: String(row.id),
    auth_id: typeof row.auth_id === "string" ? row.auth_id : null,
    dni: typeof row.dni === "string" ? row.dni : null,
    nombre: typeof row.nombre === "string" ? row.nombre : "",
    apellido: typeof row.apellido === "string" ? row.apellido : "",
    email: typeof row.email === "string" ? row.email : "",
    telefono: typeof row.telefono === "string" ? row.telefono : null,
    rol: valorRol,
    color_agenda: typeof row.color_agenda === "string" ? row.color_agenda : "#3B82F6",
    comision_porcentaje:
      typeof row.comision_porcentaje === "number"
        ? row.comision_porcentaje
        : Number(row.comision_porcentaje ?? 0),
    activo: row.activo === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function obtenerUsuarios(soloActivos = true): Promise<UsuarioRow[]> {
  let query = supabase.from("usuarios").select("*").order("nombre");
  if (soloActivos) query = query.eq("activo", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapUsuario);
}

export async function crearUsuario(payload: CrearUsuarioPayload): Promise<UsuarioRow> {
  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      nombre: payload.nombre,
      apellido: payload.apellido,
      email: payload.email,
      dni: payload.dni || null,
      telefono: payload.telefono || null,
      rol: payload.rol,
      color_agenda: payload.color_agenda ?? "#3B82F6",
      comision_porcentaje: payload.comision_porcentaje ?? 0,
      activo: payload.activo,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapUsuario(data);
}

export async function actualizarUsuario(
  id: string,
  cambios: Partial<CrearUsuarioPayload>
): Promise<UsuarioRow> {
  const updateData: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) updateData.nombre = cambios.nombre;
  if (cambios.apellido !== undefined) updateData.apellido = cambios.apellido;
  if (cambios.email !== undefined) updateData.email = cambios.email;
  if (cambios.dni !== undefined) updateData.dni = cambios.dni || null;
  if (cambios.telefono !== undefined) updateData.telefono = cambios.telefono || null;
  if (cambios.rol !== undefined) updateData.rol = cambios.rol;
  if (cambios.color_agenda !== undefined) updateData.color_agenda = cambios.color_agenda || "#3B82F6";
  if (cambios.comision_porcentaje !== undefined) updateData.comision_porcentaje = cambios.comision_porcentaje ?? 0;
  if (cambios.activo !== undefined) updateData.activo = cambios.activo;

  const { data, error } = await supabase
    .from("usuarios")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapUsuario(data);
}

export async function eliminarUsuario(id: string): Promise<void> {
  const { error } = await supabase
    .from("usuarios")
    .update({ activo: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function obtenerMiPerfil(): Promise<UsuarioRow | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_id", session.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUsuario(data) : null;
}
