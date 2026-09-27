/**
 * trabajadoresService.ts
 * Perfil específico para personal de peluquería, usando la tabla real de usuarios
 * filtrada por rol = 'trabajador'.
 */
import { supabase } from "../../lib/supabaseClient";

export interface TrabajadorRow {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  color_agenda: string | null;
  comision_porcentaje: number | null;
  activo: boolean;
  servicios: string[];
}

export async function obtenerTrabajadores(soloActivos = true): Promise<TrabajadorRow[]> {
  const { data: usuarios, error: usuariosError } = await supabase
    .from("usuarios")
    .select("id, nombre, apellido, email, telefono, color_agenda, comision_porcentaje, activo")
    .eq("rol", "trabajador")
    .order("nombre", { ascending: true });

  if (usuariosError) throw new Error(usuariosError.message);

  if (soloActivos) {
    const activos = (usuarios ?? []).filter((usuario) => usuario.activo !== false);
    return await mapearServiciosPorTrabajador(activos);
  }

  return await mapearServiciosPorTrabajador(usuarios ?? []);
}

async function mapearServiciosPorTrabajador(
  usuarios: Array<{
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono: string | null;
    color_agenda: string | null;
    comision_porcentaje: number | null;
    activo: boolean;
  }>
): Promise<TrabajadorRow[]> {
  const ids = usuarios.map((usuario) => usuario.id);

  const { data: asignaciones, error: asignacionesError } = await supabase
    .from("usuario_servicios")
    .select("usuario_id, servicio:servicios(nombre)")
    .in("usuario_id", ids.length ? ids : ["__no_match__"]);

  if (asignacionesError) throw new Error(asignacionesError.message);

  const serviciosPorUsuario = new Map<string, string[]>();
  for (const item of asignaciones ?? []) {
    const usuarioId = String((item as { usuario_id?: string }).usuario_id ?? "");
    const nombreServicio = (item as { servicio?: { nombre?: string } }).servicio?.nombre;
    if (!usuarioId || !nombreServicio) continue;

    const actuales = serviciosPorUsuario.get(usuarioId) ?? [];
    actuales.push(nombreServicio);
    serviciosPorUsuario.set(usuarioId, actuales);
  }

  return usuarios.map((usuario) => ({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    telefono: usuario.telefono,
    color_agenda: usuario.color_agenda,
    comision_porcentaje: usuario.comision_porcentaje,
    activo: usuario.activo,
    servicios: serviciosPorUsuario.get(usuario.id) ?? [],
  }));
}
