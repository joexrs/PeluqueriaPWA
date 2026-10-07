/**
 * serviciosService.ts — acceso directo a la tabla "Servicio" segun schema.sql
 */
import { supabase } from "../../lib/supabaseClient";
import type { Servicio, CrearServicioPayload, CategoriaServicio } from "./types";

// Interfaces para tipos Raw de Supabase
interface CategoriaRaw {
  ID: unknown;
  Nombre: unknown;
  Descripcion: unknown;
  Estado: unknown;
}

interface ServicioRaw {
  ID: unknown;
  Nombre: unknown;
  Descripcion: unknown;
  Precio: unknown;
  Duracion_minutos: unknown;
  Categoria_id: unknown;
  Estado: unknown;
  Created_at: unknown;
  Updated_at: unknown;
  Categoria_Servicio: unknown;
}

/**
 * Mapea una fila cruda de Supabase al tipo Categoria
 */
function mapCategoria(row: CategoriaRaw): CategoriaServicio {
  return {
    ID: String(row.ID ?? ""),
    Nombre: String(row.Nombre ?? ""),
    Descripcion: row.Descripcion ? String(row.Descripcion) : null,
    Estado: row.Estado !== false,
    id: String(row.ID ?? ""),
    nombre: String(row.Nombre ?? ""),
    descripcion: row.Descripcion ? String(row.Descripcion) : null,
  };
}

/**
 * Mapea una fila cruda de Supabase al tipo Servicio
 */
function mapServicio(raw: ServicioRaw): Servicio {
  const cat = raw.Categoria_Servicio as CategoriaRaw | null;
  const nombre = String(raw.Nombre ?? "");
  const descripcion = raw.Descripcion ? String(raw.Descripcion) : null;
  const precio = Number(raw.Precio ?? 0);
  const duracion = Number(raw.Duracion_minutos ?? 30);
  const categoriaId = raw.Categoria_id ? String(raw.Categoria_id) : null;
  const categoria = cat ? mapCategoria(cat) : null;
  return {
    ID: String(raw.ID ?? ""),
    Nombre: nombre,
    Descripcion: descripcion,
    Precio: precio,
    Duracion_minutos: duracion,
    Categoria_id: categoriaId,
    Estado: raw.Estado !== false,
    Created_at: raw.Created_at ? String(raw.Created_at) : undefined,
    Updated_at: raw.Updated_at ? String(raw.Updated_at) : undefined,
    Categoria_Servicio: categoria,
    id: String(raw.ID ?? ""),
    nombre,
    descripcion,
    precio_base: precio,
    precio,
    duracion_minutos: duracion,
    duracion,
    categoria_id: categoriaId,
    activo: raw.Estado !== false,
    categoria,
  };
}

/**
 * Obtiene todas las categorias de servicios
 */
export async function obtenerCategoriasServicios(): Promise<CategoriaServicio[]> {
  const { data, error } = await supabase
    .from("Categoria_Servicio")
    .select("*")
    .eq("Estado", true)
    .order("Nombre");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCategoria);
}

/**
 * Obtiene todos los servicios (con busqueda opcional)
 */
export async function obtenerServicios(busqueda = ""): Promise<Servicio[]> {
  let query = supabase
    .from("Servicio")
    .select("*, Categoria_Servicio(*)")
    .eq("Estado", true)
    .order("Nombre");

  if (busqueda.trim()) {
    const q = busqueda.trim();
    query = query.or(`Nombre.ilike.%${q}%,Descripcion.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapServicio);
}

/**
 * Obtiene un servicio por su ID
 */
export async function obtenerServicioPorId(id: string): Promise<Servicio> {
  const { data, error } = await supabase
    .from("Servicio")
    .select("*, Categoria_Servicio(*)")
    .eq("ID", id)
    .single();

  if (error) throw new Error(error.message);
  return mapServicio(data as ServicioRaw);
}

/**
 * Crea un nuevo servicio
 */
export async function crearServicio(payload: CrearServicioPayload): Promise<Servicio> {
  const nombre = payload.Nombre ?? payload.nombre;
  const precio = payload.Precio ?? payload.precio_base;
  const duracion = payload.Duracion_minutos ?? payload.duracion_minutos;
  if (!nombre || precio === undefined || duracion === undefined) {
    throw new Error("Nombre, precio y duración son obligatorios.");
  }

  const { data, error } = await supabase
    .from("Servicio")
    .insert({
      Nombre: nombre,
      Descripcion: payload.Descripcion || null,
      Precio: precio,
      Duracion_minutos: duracion,
      Categoria_id: payload.Categoria_id ?? payload.categoria_id ?? null,
      Estado: true,
    })
    .select("*, Categoria_Servicio(*)")
    .single();

  if (error) throw new Error(error.message);
  return mapServicio(data as ServicioRaw);
}

/**
 * Actualiza un servicio existente
 */
export async function actualizarServicio(
  id: string,
  cambios: Partial<CrearServicioPayload>
): Promise<Servicio> {
  const updateData: Record<string, unknown> = {};
  
  if (cambios.Nombre !== undefined || cambios.nombre !== undefined) {
    updateData.Nombre = cambios.Nombre ?? cambios.nombre;
  }
  if (cambios.Descripcion !== undefined) updateData.Descripcion = cambios.Descripcion || null;
  if (cambios.Precio !== undefined || cambios.precio_base !== undefined) {
    updateData.Precio = cambios.Precio ?? cambios.precio_base;
  }
  if (cambios.Duracion_minutos !== undefined || cambios.duracion_minutos !== undefined) {
    updateData.Duracion_minutos = cambios.Duracion_minutos ?? cambios.duracion_minutos;
  }
  if (cambios.Categoria_id !== undefined || cambios.categoria_id !== undefined) {
    updateData.Categoria_id = cambios.Categoria_id ?? cambios.categoria_id ?? null;
  }

  const { data, error } = await supabase
    .from("Servicio")
    .update(updateData)
    .eq("ID", id)
    .select("*, Categoria_Servicio(*)")
    .single();

  if (error) throw new Error(error.message);
  return mapServicio(data as ServicioRaw);
}

/**
 * Desactiva un servicio (borrado logico)
 */
export async function eliminarServicio(id: string): Promise<void> {
  const { error } = await supabase
    .from("Servicio")
    .update({ Estado: false })
    .eq("ID", id);

  if (error) throw new Error(error.message);
}
// ==================== EXPORTS DE COMPATIBILIDAD ====================
export type ServicioRow = Servicio;
export type CategoriaServicioRow = CategoriaServicio;

export function toServicioRow(servicio: Servicio): ServicioRow {
  return {
    ...servicio,
    id: servicio.ID || "",
  };
}

export function toCategoriaRow(cat: CategoriaServicio): CategoriaServicioRow {
  return {
    ...cat,
    id: cat.ID || "",
    nombre: cat.Nombre || "",
  };
}