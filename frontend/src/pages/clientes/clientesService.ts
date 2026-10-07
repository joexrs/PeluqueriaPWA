/**
 * clientesService.ts — acceso directo a la tabla "Cliente" según schema.sql
 */
import { supabase } from "../../lib/supabaseClient";
import type { Cliente, CrearClientePayload } from "./types";

// Interfaces para tipos Raw de Supabase
interface ClienteRaw {
  ID: unknown;
  Nombre: unknown;
  Apellido: unknown;
  Telefono: unknown;
  E_mail: unknown;
  DNI: unknown;
  Fecha_Nacimiento: unknown;
  Total_visitas: unknown;
  Preferencias: unknown;
  Estado: unknown;
  Created_at: unknown;
  Updated_at: unknown;
}

/**
 * Mapea una fila cruda de Supabase al tipo Cliente
 */
function mapCliente(row: ClienteRaw): Cliente {
  let prefs: Record<string, unknown> | null = null;
  if (row.Preferencias) {
    try {
      prefs = typeof row.Preferencias === 'string'
        ? JSON.parse(row.Preferencias)
        : row.Preferencias as Record<string, unknown>;
    } catch {
      prefs = null;
    }
  }

  const nombre = String(row.Nombre ?? "");
  const apellido = row.Apellido ? String(row.Apellido) : "";
  const telefono = row.Telefono ? String(row.Telefono) : "";
  const email = row.E_mail ? String(row.E_mail) : null;

  return {
    // Nuevos nombres (schema.sql)
    ID: String(row.ID ?? ""),
    Nombre: nombre,
    Apellido: apellido,
    Telefono: telefono || null,
    E_mail: email,
    DNI: row.DNI ? String(row.DNI) : null,
    Fecha_Nacimiento: row.Fecha_Nacimiento ? String(row.Fecha_Nacimiento) : null,
    Total_visitas: row.Total_visitas ? Number(row.Total_visitas) : 0,
    Preferencias: prefs,
    Estado: row.Estado !== false,
    Created_at: row.Created_at ? String(row.Created_at) : undefined,
    Updated_at: row.Updated_at ? String(row.Updated_at) : undefined,
    // Alias de compatibilidad para la UI
    id: String(row.ID ?? ""),
    nombre: nombre,
    apellido: apellido,
    telefono: telefono,
    email: email,
    fecha_nacimiento: row.Fecha_Nacimiento ? String(row.Fecha_Nacimiento) : null,
    notas_preferencias: prefs
      ? typeof prefs.notas === "string"
        ? prefs.notas
        : JSON.stringify(prefs)
      : null,
    total_visitas: row.Total_visitas ? Number(row.Total_visitas) : 0,
    activo: row.Estado !== false,
  };
}

/**
 * Obtiene todos los clientes (con búsqueda opcional)
 */
export async function obtenerClientes(busqueda = ""): Promise<Cliente[]> {
  let query = supabase
    .from("Cliente")
    .select("*")
    .eq("Estado", true)
    .order("Nombre");

  if (busqueda.trim()) {
    const q = busqueda.trim();
    query = query.or(
      `Nombre.ilike.%${q}%,Apellido.ilike.%${q}%,Telefono.ilike.%${q}%,E_mail.ilike.%${q}%,DNI.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCliente);
}

/**
 * Obtiene un cliente por su ID
 */
export async function obtenerClientePorId(id: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from("Cliente")
    .select("*")
    .eq("ID", id)
    .single();

  if (error) throw new Error(error.message);
  return mapCliente(data as ClienteRaw);
}

/**
 * Crea un nuevo cliente
 */
export async function crearCliente(payload: CrearClientePayload): Promise<Cliente> {
  const nombre = payload.Nombre ?? payload.nombre;
  const apellido = payload.Apellido ?? payload.apellido;
  if (!nombre || !apellido) throw new Error("Nombre y apellido son obligatorios.");

  const { data, error } = await supabase
    .from("Cliente")
    .insert({
      Nombre: nombre,
      Apellido: apellido,
      Telefono: payload.Telefono ?? payload.telefono ?? null,
      E_mail: payload.E_mail ?? payload.email ?? null,
      DNI: payload.DNI ?? payload.dni ?? null,
      Fecha_Nacimiento: payload.Fecha_Nacimiento ?? payload.fecha_nacimiento ?? null,
      Preferencias: payload.Preferencias ?? (
        payload.notas_preferencias?.trim()
          ? { notas: payload.notas_preferencias.trim() }
          : null
      ),
      Total_visitas: 0,
      Estado: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapCliente(data as ClienteRaw);
}

/**
 * Actualiza un cliente existente
 */
export async function actualizarCliente(
  id: string,
  cambios: Partial<CrearClientePayload>
): Promise<Cliente> {
  const updateData: Record<string, unknown> = {};

  if (cambios.Nombre !== undefined || cambios.nombre !== undefined) {
    updateData.Nombre = cambios.Nombre ?? cambios.nombre;
  }
  if (cambios.Apellido !== undefined || cambios.apellido !== undefined) {
    updateData.Apellido = cambios.Apellido ?? cambios.apellido ?? "";
  }
  if (cambios.Telefono !== undefined || cambios.telefono !== undefined) {
    updateData.Telefono = cambios.Telefono ?? cambios.telefono ?? null;
  }
  if (cambios.E_mail !== undefined || cambios.email !== undefined) {
    updateData.E_mail = cambios.E_mail ?? cambios.email ?? null;
  }
  if (cambios.DNI !== undefined || cambios.dni !== undefined) {
    updateData.DNI = cambios.DNI ?? cambios.dni ?? null;
  }
  if (cambios.Fecha_Nacimiento !== undefined || cambios.fecha_nacimiento !== undefined) {
    updateData.Fecha_Nacimiento = cambios.Fecha_Nacimiento ?? cambios.fecha_nacimiento ?? null;
  }
  if (cambios.Preferencias !== undefined) {
    updateData.Preferencias = cambios.Preferencias;
  } else if (cambios.notas_preferencias !== undefined) {
    const notas = (cambios.notas_preferencias ?? "").trim();
    updateData.Preferencias = notas ? { notas } : null;
  }

  const { data, error } = await supabase
    .from("Cliente")
    .update(updateData)
    .eq("ID", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapCliente(data as ClienteRaw);
}

/**
 * Desactiva un cliente (borrado lógico)
 */
export async function eliminarCliente(id: string): Promise<void> {
  const { error } = await supabase
    .from("Cliente")
    .update({ Estado: false })
    .eq("ID", id);

  if (error) throw new Error(error.message);
}
// ==================== EXPORTS DE COMPATIBILIDAD ====================
export type ClienteRow = Cliente;

export function toClienteRow(cliente: Cliente): ClienteRow {
  return {
    ...cliente,
    id: cliente.ID || "",
  };
}