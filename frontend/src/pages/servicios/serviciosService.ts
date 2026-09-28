/**
 * serviciosService.ts — acceso directo a la tabla real `servicios` y su categoría.
 */
import { supabase } from "../../lib/supabaseClient";

/** Tipo para la respuesta cruda de Supabase */
interface CategoriaRaw {
  id: unknown;
  nombre: unknown;
  descripcion: unknown;
  color: unknown;
}

interface ServicioRaw {
  id: unknown;
  categoria_id: unknown;
  nombre: unknown;
  descripcion: unknown;
  precio_base: unknown;
  duracion_minutos: unknown;
  tiempo_limpieza_minutos: unknown;
  aforo_maximo_diario: unknown;
  aforo_simultaneo_maximo: unknown;
  activo: unknown;
  categoria: unknown;
}

export interface CategoriaServicioRow {
  id: string;
  nombre: string;
  descripcion?: string | null;
  color?: string | null;
}

export interface ServicioRow {
  id: string;
  categoria_id?: string | null;
  nombre: string;
  descripcion?: string | null;
  precio_base: number;
  duracion_minutos: number;
  tiempo_limpieza_minutos: number;
  aforo_maximo_diario: number;
  aforo_simultaneo_maximo: number;
  activo: boolean;
  categoria?: CategoriaServicioRow | null;
}

export interface CrearServicioPayload {
  nombre: string;
  categoria_id?: string | null;
  descripcion?: string | null;
  precio_base: number;
  duracion_minutos: number;
  tiempo_limpieza_minutos?: number;
  aforo_maximo_diario?: number;
  aforo_simultaneo_maximo?: number;
}

function mapCategoriaRow(row: CategoriaRaw): CategoriaServicioRow {
  return {
    id: String(row.id ?? ""),
    nombre: String(row.nombre ?? ""),
    descripcion: row.descripcion ? String(row.descripcion) : null,
    color: row.color ? String(row.color) : null,
  };
}

function mapServicioRow(raw: ServicioRaw): ServicioRow {
  const cat = raw.categoria as CategoriaRaw | null;
  return {
    id: String(raw.id ?? ""),
    categoria_id: raw.categoria_id ? String(raw.categoria_id) : null,
    nombre: String(raw.nombre ?? ""),
    descripcion: raw.descripcion ? String(raw.descripcion) : null,
    precio_base: Number(raw.precio_base ?? 0),
    duracion_minutos: Number(raw.duracion_minutos ?? 0),
    tiempo_limpieza_minutos: Number(raw.tiempo_limpieza_minutos ?? 0),
    aforo_maximo_diario: Number(raw.aforo_maximo_diario ?? 0),
    aforo_simultaneo_maximo: Number(raw.aforo_simultaneo_maximo ?? 0),
    activo: Boolean(raw.activo ?? true),
    categoria: cat ? mapCategoriaRow(cat) : null,
  };
}

export async function obtenerCategoriasServicios(): Promise<CategoriaServicioRow[]> {
  const { data, error } = await supabase
    .from("categorias_servicios")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaServicioRow[];
}

export async function obtenerServicios(busqueda = ""): Promise<ServicioRow[]> {
  let query = supabase
    .from("servicios")
    .select("*, categoria:categorias_servicios(*)")
    .eq("activo", true)
    .order("nombre");

  if (busqueda.trim()) {
    const q = busqueda.trim();
    query = query.or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapServicioRow);
}

export async function obtenerServicioPorId(id: string): Promise<ServicioRow> {
  const { data, error } = await supabase
    .from("servicios")
    .select("*, categoria:categorias_servicios(*)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapServicioRow(data);
}

export async function crearServicio(payload: CrearServicioPayload): Promise<ServicioRow> {
  const { data, error } = await supabase
    .from("servicios")
    .insert({
      nombre: payload.nombre,
      categoria_id: payload.categoria_id ?? null,
      descripcion: payload.descripcion ?? null,
      precio_base: payload.precio_base,
      duracion_minutos: payload.duracion_minutos,
      tiempo_limpieza_minutos: payload.tiempo_limpieza_minutos ?? 5,
      aforo_maximo_diario: payload.aforo_maximo_diario ?? 10,
      aforo_simultaneo_maximo: payload.aforo_simultaneo_maximo ?? 2,
    })
    .select("*, categoria:categorias_servicios(*)")
    .single();

  if (error) throw new Error(error.message);
  return mapServicioRow(data);
}

export async function actualizarServicio(
  id: string,
  cambios: Partial<CrearServicioPayload>
): Promise<ServicioRow> {
  const updateData: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) updateData.nombre = cambios.nombre;
  if (cambios.categoria_id !== undefined) updateData.categoria_id = cambios.categoria_id ?? null;
  if (cambios.descripcion !== undefined) updateData.descripcion = cambios.descripcion ?? null;
  if (cambios.precio_base !== undefined) updateData.precio_base = cambios.precio_base;
  if (cambios.duracion_minutos !== undefined) updateData.duracion_minutos = cambios.duracion_minutos;
  if (cambios.tiempo_limpieza_minutos !== undefined) updateData.tiempo_limpieza_minutos = cambios.tiempo_limpieza_minutos;
  if (cambios.aforo_maximo_diario !== undefined) updateData.aforo_maximo_diario = cambios.aforo_maximo_diario;
  if (cambios.aforo_simultaneo_maximo !== undefined) updateData.aforo_simultaneo_maximo = cambios.aforo_simultaneo_maximo;

  const { data, error } = await supabase
    .from("servicios")
    .update(updateData)
    .eq("id", id)
    .select("*, categoria:categorias_servicios(*)")
    .single();

  if (error) throw new Error(error.message);
  return mapServicioRow(data);
}

export async function eliminarServicio(id: string): Promise<void> {
  const { error } = await supabase
    .from("servicios")
    .update({ activo: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
