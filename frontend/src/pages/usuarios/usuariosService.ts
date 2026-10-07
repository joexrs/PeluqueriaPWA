/**
 * usuariosService.ts — acceso directo a la tabla "Usuario" según schema.sql
 */
import { supabase } from "../../lib/supabaseClient";
import type { Usuario, CrearUsuarioPayload } from "./types";

// Interfaces para tipos Raw de Supabase
interface UsuarioRaw {
  ID: unknown;
  DNI: unknown;
  Nombre: unknown;
  Apellido: unknown;
  E_mail: unknown;
  Telefono: unknown;
  Usuario: unknown;
  Color_agenda: unknown;
  Comision_porcentaje: unknown;
  Rol_id: unknown;
  Rol: unknown;
  Estado: unknown;
  Created_at: unknown;
  Updated_at: unknown;
}

/**
 * Mapea una fila cruda de Supabase al tipo Usuario
 */
function mapUsuario(row: UsuarioRaw): Usuario {
  const rolRelacion = Array.isArray(row.Rol) ? row.Rol[0] : row.Rol;
  const rolNombre = typeof rolRelacion === "object" && rolRelacion !== null
    ? String((rolRelacion as { Nombre?: unknown }).Nombre ?? "").toLowerCase()
    : "";
  const roles: RolUsuario[] = ["admin", "jefe", "recepcionista", "trabajador"];
  return {
    ID: String(row.ID ?? ""),
    id: String(row.ID ?? ""), // Para compatibilidad con UI
    DNI: row.DNI ? String(row.DNI) : null,
    nombre: String(row.Nombre ?? ""), // Para compatibilidad con UI
    Nombre: String(row.Nombre ?? ""),
    Apellido: String(row.Apellido ?? ""),
    apellido: String(row.Apellido ?? ""), // Para compatibilidad con UI
    E_mail: String(row.E_mail ?? ""),
    email: String(row.E_mail ?? ""), // Para compatibilidad con UI
    Telefono: row.Telefono ? String(row.Telefono) : null,
    telefono: row.Telefono ? String(row.Telefono) : null, // Para compatibilidad
    Usuario: row.Usuario ? String(row.Usuario) : "",
    Color_agenda: row.Color_agenda ? String(row.Color_agenda) : "#000000",
    color_agenda: row.Color_agenda ? String(row.Color_agenda) : "#000000", // UI
    Comision_porcentaje: row.Comision_porcentaje
      ? Number(row.Comision_porcentaje)
      : 0,
    comision_porcentaje: row.Comision_porcentaje
      ? Number(row.Comision_porcentaje)
      : 0, // UI
    Rol_id: row.Rol_id ? Number(row.Rol_id) : null,
    rol: roles.includes(rolNombre as RolUsuario) ? rolNombre as RolUsuario : "trabajador",
    Estado: row.Estado !== false,
    activo: row.Estado !== false, // Para compatibilidad con UI
    Created_at: row.Created_at ? String(row.Created_at) : undefined,
    Updated_at: row.Updated_at ? String(row.Updated_at) : undefined,
  };
}

/**
 * Obtiene todos los usuarios (o solo los activos)
 */
export async function obtenerUsuarios(soloActivos = true): Promise<Usuario[]> {
  let query = supabase
    .from("Usuario")
    .select("ID, DNI, Nombre, Apellido, E_mail, Telefono, Usuario, Color_agenda, Comision_porcentaje, Rol_id, Estado, Created_at, Updated_at, Rol(ID, Nombre, Estado)")
    .order("Nombre");
  if (soloActivos) query = query.eq("Estado", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapUsuario);
}

/**
 * Obtiene un usuario por su ID
 */
export async function obtenerUsuarioPorId(id: string): Promise<Usuario> {
  const { data, error } = await supabase
    .from("Usuario")
    .select("ID, DNI, Nombre, Apellido, E_mail, Telefono, Usuario, Color_agenda, Comision_porcentaje, Rol_id, Estado, Created_at, Updated_at")
    .eq("ID", id)
    .single();

  if (error) throw new Error(error.message);
  return mapUsuario(data as UsuarioRaw);
}

/**
 * Crea un nuevo usuario
 * La contraseña se cifra automáticamente en la BD (trigger)
 */
export async function crearUsuario(payload: CrearUsuarioPayload): Promise<Usuario> {
  if (
    payload.rol !== "recepcionista" &&
    payload.rol !== "trabajador"
  ) {
    throw new Error("Solo se pueden crear usuarios con rol recepcionista o trabajador.");
  }
  if (!payload.usuario?.trim() || !payload.password) {
    throw new Error("El usuario y la contraseña son obligatorios.");
  }

  const { data: rolData, error: rolError } = await supabase
    .from("Rol")
    .select("ID")
    .eq("Nombre", payload.rol)
    .eq("Estado", true)
    .single();

  if (rolError) {
    throw new Error(`No se pudo obtener el rol seleccionado: ${rolError.message}`);
  }

  const response = await supabase.functions.invoke("crear-usuario", {
    body: {
      nombre: payload.nombre?.trim(),
      apellido: payload.apellido?.trim(),
      email: payload.email?.trim(),
      password: payload.password,
      usuario: payload.usuario.trim(),
      rol_id: Number(rolData.ID),
      dni: payload.dni?.trim() || null,
      telefono: payload.telefono?.trim() || null,
      color_agenda: payload.color_agenda || "#3B82F6",
      comision_porcentaje: payload.comision_porcentaje ?? 0,
    },
  });

  const { data: functionData, error } = response;
  
  console.log("DATA:", functionData);
  console.log("ERROR:", error);

  if ((error as any)?.context) {
    const errorResponse = (error as any).context as Response;
    console.log("STATUS:", errorResponse.status);
    console.log("STATUS TEXT:", errorResponse.statusText);
    try {
      const texto = await errorResponse.text();
      console.log("RESPUESTA REAL:", texto);
    } catch (e) {
      console.log("No se pudo leer el body:", e);
    }
  }

  if (error) {
    throw new Error(error.message || "No se pudo crear el usuario.");
  }

  return obtenerUsuarioCreado(payload.email ?? "");
}

async function obtenerUsuarioCreado(email: string): Promise<Usuario> {
  const usuarios = await obtenerUsuarios(false);
  const usuario = usuarios.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!usuario) {
    throw new Error("El usuario se creó, pero no se pudo recuperar su perfil.");
  }
  return usuario;
}

/**
 * Actualiza un usuario existente
 * Para cambiar contraseña, enviar la nueva en texto plano (se cifra en la BD)
 */
export async function actualizarUsuario(
  id: string,
  cambios: Partial<CrearUsuarioPayload>
): Promise<Usuario> {
  const updateData: Record<string, unknown> = {};

  if (cambios.DNI !== undefined) updateData.DNI = cambios.DNI || null;
  if (cambios.dni !== undefined) updateData.DNI = cambios.dni;
  if (cambios.Nombre !== undefined || cambios.nombre !== undefined) updateData.Nombre = cambios.Nombre ?? cambios.nombre;
  if (cambios.Apellido !== undefined || cambios.apellido !== undefined) updateData.Apellido = cambios.Apellido ?? cambios.apellido;
  if (cambios.E_mail !== undefined || cambios.email !== undefined) updateData.E_mail = cambios.E_mail ?? cambios.email;
  if (cambios.Telefono !== undefined || cambios.telefono !== undefined) updateData.Telefono = cambios.Telefono ?? cambios.telefono ?? null;
  if (cambios.Usuario !== undefined) updateData.Usuario = cambios.Usuario;
  if (cambios.Color_agenda !== undefined) updateData.Color_agenda = cambios.Color_agenda || "#000000";
  if (cambios.Comision_porcentaje !== undefined) updateData.Comision_porcentaje = cambios.Comision_porcentaje ?? 0;
  if (cambios.Rol_id !== undefined) updateData.Rol_id = cambios.Rol_id;
  if (cambios.Color_agenda !== undefined || cambios.color_agenda !== undefined) {
    updateData.Color_agenda = cambios.Color_agenda ?? cambios.color_agenda ?? "#000000";
  }
  if (cambios.Comision_porcentaje !== undefined || cambios.comision_porcentaje !== undefined) {
    updateData.Comision_porcentaje = cambios.Comision_porcentaje ?? cambios.comision_porcentaje ?? 0;
  }
  if (cambios.activo !== undefined) updateData.Estado = cambios.activo;
  if (cambios.rol) {
    const { data: roleData, error: roleError } = await supabase
      .from("Rol")
      .select("ID")
      .eq("Nombre", cambios.rol)
      .single();
    if (roleError) throw new Error(roleError.message);
    updateData.Rol_id = roleData.ID;
  }

  const { data, error } = await supabase
    .from("Usuario")
    .update(updateData)
    .eq("ID", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapUsuario(data as UsuarioRaw);
}

/** Obtiene los servicios habilitados para un trabajador. */
export async function obtenerServiciosTrabajador(usuarioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("Trabajador_Servicio")
    .select("Servicio_id")
    .eq("usuario_id", usuarioId)
    .eq("Estado", true);

  if (error) throw new Error(`No se pudieron cargar los servicios del trabajador: ${error.message}`);
  return (data ?? []).map((row) => String(row.Servicio_id));
}

/** Actualiza las asignaciones sin borrar relaciones históricas usadas por citas. */
export async function guardarServiciosTrabajador(usuarioId: string, serviciosIds: string[] = []): Promise<void> {
  const { error: desactivarError } = await supabase
    .from("Trabajador_Servicio")
    .update({ Estado: false })
    .eq("usuario_id", usuarioId);

  if (desactivarError) throw new Error(`No se pudieron actualizar los servicios del trabajador: ${desactivarError.message}`);
  if (serviciosIds.length === 0) return;

  const filas = [...new Set(serviciosIds)].map((servicioId) => ({
    usuario_id: Number(usuarioId),
    Servicio_id: Number(servicioId),
    Estado: true,
  }));
  const { error } = await supabase
    .from("Trabajador_Servicio")
    .upsert(filas, { onConflict: "usuario_id,Servicio_id" });
  if (error) throw new Error(`No se pudieron guardar los servicios del trabajador: ${error.message}`);
}

/**
 * Desactiva un usuario (borrado lógico)
 */
export async function eliminarUsuario(id: string): Promise<void> {
  const { error } = await supabase
    .from("Usuario")
    .update({ Estado: false })
    .eq("ID", id);

  if (error) throw new Error(error.message);
}

/**
 * Obtiene los roles disponibles de la tabla Rol
 */
export async function obtenerRoles(): Promise<{ ID: number; Nombre: string }[]> {
  const { data, error } = await supabase
    .from("Rol")
    .select("ID, Nombre")
    .eq("Estado", true)
    .order("Nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as { ID: number; Nombre: string }[];
}
// ==================== EXPORTS DE COMPATIBILIDAD ====================
// Para compatibilidad con componentes que usan nombres antiguos

export type RolUsuario = "admin" | "jefe" | "recepcionista" | "trabajador";

// Alias para compatibilidad -mapUsuario retorna tipo Usuario con propiedad 'id' para la UI
export type UsuarioRow = Usuario;

// Funcion auxiliar para compatibilidad con UI legacy
export function toUsuarioRow(usuario: Usuario): UsuarioRow {
  return {
    ...usuario,
    id: usuario.ID || usuario.id || "",
  };
}
// ==================== EXPORTS ADICIONALES PARA COMPATIBILIDAD ====================

// Exportar como "Rol" para compatibilidad
export type Rol = RolUsuario;
