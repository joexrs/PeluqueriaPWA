/**
 * Consultas de trabajadores y servicios usando las tablas definidas en schema.sql.
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

interface UsuarioTrabajadorRaw {
  ID: unknown;
  Nombre: unknown;
  Apellido: unknown;
  E_mail: unknown;
  Telefono: unknown;
  Color_agenda: unknown;
  Comision_porcentaje: unknown;
  Estado: unknown;
}

interface AsignacionRaw {
  usuario_id: unknown;
  Servicio: { Nombre?: unknown } | null;
}

export async function obtenerTrabajadores(soloActivos = true): Promise<TrabajadorRow[]> {
  const { data: rol, error: rolError } = await supabase
    .from("Rol")
    .select("ID")
    .eq("Nombre", "trabajador")
    .eq("Estado", true)
    .single();
  if (rolError) throw new Error(rolError.message);

  let query = supabase
    .from("Usuario")
    .select("ID, Nombre, Apellido, E_mail, Telefono, Color_agenda, Comision_porcentaje, Estado")
    .eq("Rol_id", rol.ID)
    .order("Nombre", { ascending: true });
  if (soloActivos) query = query.eq("Estado", true);

  const { data: usuarios, error: usuariosError } = await query;
  if (usuariosError) throw new Error(usuariosError.message);

  const trabajadores = (usuarios ?? []) as UsuarioTrabajadorRaw[];
  const ids = trabajadores.map((usuario) => String(usuario.ID));
  const serviciosPorUsuario = await obtenerServiciosPorTrabajador(ids);

  return trabajadores.map((usuario) => {
    const id = String(usuario.ID);
    return {
      id,
      nombre: String(usuario.Nombre ?? ""),
      apellido: String(usuario.Apellido ?? ""),
      email: String(usuario.E_mail ?? ""),
      telefono: usuario.Telefono ? String(usuario.Telefono) : null,
      color_agenda: usuario.Color_agenda ? String(usuario.Color_agenda) : null,
      comision_porcentaje:
        usuario.Comision_porcentaje == null ? null : Number(usuario.Comision_porcentaje),
      activo: usuario.Estado !== false,
      servicios: serviciosPorUsuario.get(id) ?? [],
    };
  });
}

export async function obtenerIdsTrabajadoresPorServicio(servicioId: string): Promise<string[]> {
  if (!servicioId) return [];
  const { data, error } = await supabase
    .from("Trabajador_Servicio")
    .select("usuario_id")
    .eq("Servicio_id", servicioId)
    .eq("Estado", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String(row.usuario_id));
}

async function obtenerServiciosPorTrabajador(
  usuarioIds: string[],
): Promise<Map<string, string[]>> {
  const serviciosPorUsuario = new Map<string, string[]>();
  if (usuarioIds.length === 0) return serviciosPorUsuario;

  const { data, error } = await supabase
    .from("Trabajador_Servicio")
    .select("usuario_id, Servicio:Servicio!FK_TrabajadorServicio_Servicio(Nombre)")
    .in("usuario_id", usuarioIds)
    .eq("Estado", true);
  if (error) throw new Error(error.message);

  for (const asignacion of (data ?? []) as AsignacionRaw[]) {
    const usuarioId = String(asignacion.usuario_id ?? "");
    const nombre = String(asignacion.Servicio?.Nombre ?? "");
    if (!usuarioId || !nombre) continue;

    const servicios = serviciosPorUsuario.get(usuarioId) ?? [];
    servicios.push(nombre);
    serviciosPorUsuario.set(usuarioId, servicios);
  }

  return serviciosPorUsuario;
}
