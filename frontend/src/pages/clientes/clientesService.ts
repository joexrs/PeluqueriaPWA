/**
 * clientesService.ts — acceso directo a la tabla real `clientes` de Supabase.
 */
import { supabase } from "../../lib/supabaseClient";

/** Tipo para la respuesta cruda de Supabase */
interface ClienteRaw {
  id: unknown;
  nombre: unknown;
  apellido: unknown;
  telefono: unknown;
  email: unknown;
  fecha_nacimiento: unknown;
  notas_preferencias: unknown;
  total_visitas: unknown;
  activo: unknown;
  created_at: unknown;
  updated_at: unknown;
}

export interface ClienteRow {
  id: string;
  nombre: string;
  apellido?: string | null;
  telefono: string;
  email?: string | null;
  fecha_nacimiento?: string | null;
  notas_preferencias?: string | null;
  total_visitas?: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CrearClientePayload {
  nombre: string;
  apellido?: string | null;
  telefono: string;
  email?: string | null;
  fecha_nacimiento?: string | null;
  notas_preferencias?: string | null;
}

function mapClienteRow(row: ClienteRaw): ClienteRow {
  return {
    id: String(row.id ?? ""),
    nombre: String(row.nombre ?? ""),
    apellido: row.apellido ? String(row.apellido) : null,
    telefono: String(row.telefono ?? ""),
    email: row.email ? String(row.email) : null,
    fecha_nacimiento: row.fecha_nacimiento ? String(row.fecha_nacimiento) : null,
    notas_preferencias: row.notas_preferencias ? String(row.notas_preferencias) : null,
    total_visitas: Number(row.total_visitas ?? 0),
    activo: Boolean(row.activo ?? true),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function obtenerClientes(busqueda = ""): Promise<ClienteRow[]> {
  let query = supabase
    .from("clientes")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  if (busqueda.trim()) {
    const q = busqueda.trim();
    query = query.or(
      `nombre.ilike.%${q}%,apellido.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%,notas_preferencias.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapClienteRow);
}

export async function obtenerClientePorId(id: string): Promise<ClienteRow> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapClienteRow(data);
}

export async function crearCliente(payload: CrearClientePayload): Promise<ClienteRow> {
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre: payload.nombre,
      apellido: payload.apellido || null,
      telefono: payload.telefono,
      email: payload.email || null,
      fecha_nacimiento: payload.fecha_nacimiento || null,
      notas_preferencias: payload.notas_preferencias || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapClienteRow(data);
}

export async function actualizarCliente(
  id: string,
  cambios: Partial<CrearClientePayload>
): Promise<ClienteRow> {
  const updateData: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) updateData.nombre = cambios.nombre;
  if (cambios.apellido !== undefined) updateData.apellido = cambios.apellido || null;
  if (cambios.telefono !== undefined) updateData.telefono = cambios.telefono;
  if (cambios.email !== undefined) updateData.email = cambios.email || null;
  if (cambios.fecha_nacimiento !== undefined) updateData.fecha_nacimiento = cambios.fecha_nacimiento || null;
  if (cambios.notas_preferencias !== undefined) updateData.notas_preferencias = cambios.notas_preferencias || null;

  const { data, error } = await supabase
    .from("clientes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapClienteRow(data);
}

export async function eliminarCliente(id: string): Promise<void> {
  const { error } = await supabase
    .from("clientes")
    .update({ activo: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
