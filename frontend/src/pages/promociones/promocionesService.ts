import { supabase } from "../../lib/supabaseClient";
import type { Promocion } from "./types";

interface PromocionRaw {
  ID: unknown;
  Nombre: unknown;
  Descripcion: unknown;
  Porcentaje_Descuento: unknown;
  Fecha_Inicio: unknown;
  Fecha_Fin: unknown;
  Servicio_ID: unknown;
  Estado: unknown;
  Servicio: unknown;
}

function mapPromocion(raw: PromocionRaw): Promocion {
  const servicio = raw.Servicio as { Nombre?: unknown } | null;
  return {
    id: String(raw.ID ?? ""),
    titulo: String(raw.Nombre ?? ""),
    descripcion: String(raw.Descripcion ?? ""),
    descuento: Number(raw.Porcentaje_Descuento ?? 0),
    servicioId: raw.Servicio_ID ? String(raw.Servicio_ID) : "",
    servicioNombre: servicio?.Nombre ? String(servicio.Nombre) : null,
    fechaInicio: String(raw.Fecha_Inicio ?? ""),
    fechaFin: String(raw.Fecha_Fin ?? ""),
    activa: raw.Estado !== false,
  };
}

const PROMOCION_SELECT = `
  ID, Nombre, Descripcion, Porcentaje_Descuento, Fecha_Inicio, Fecha_Fin, Servicio_ID, Estado,
  Servicio:Servicio!FK_Promocion_Servicio(Nombre)
`;

export async function obtenerPromociones(): Promise<Promocion[]> {
  const { data, error } = await supabase
    .from("Promocion")
    .select(PROMOCION_SELECT)
    .order("Fecha_Inicio", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapPromocion(row as unknown as PromocionRaw));
}

export async function crearPromocion(
  payload: Omit<Promocion, "id" | "servicioNombre">
): Promise<Promocion> {
  const { data, error } = await supabase
    .from("Promocion")
    .insert({
      Nombre: payload.titulo,
      Descripcion: payload.descripcion || null,
      Porcentaje_Descuento: payload.descuento,
      Fecha_Inicio: payload.fechaInicio,
      Fecha_Fin: payload.fechaFin,
      Servicio_ID: payload.servicioId || null,
      Estado: payload.activa,
    })
    .select(PROMOCION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapPromocion(data as unknown as PromocionRaw);
}

export async function actualizarPromocion(
  id: string,
  payload: Partial<Omit<Promocion, "id" | "servicioNombre">>
): Promise<Promocion> {
  const cambios: Record<string, unknown> = {};
  if (payload.titulo !== undefined) cambios.Nombre = payload.titulo;
  if (payload.descripcion !== undefined) cambios.Descripcion = payload.descripcion || null;
  if (payload.descuento !== undefined) cambios.Porcentaje_Descuento = payload.descuento;
  if (payload.fechaInicio !== undefined) cambios.Fecha_Inicio = payload.fechaInicio;
  if (payload.fechaFin !== undefined) cambios.Fecha_Fin = payload.fechaFin;
  if (payload.servicioId !== undefined) cambios.Servicio_ID = payload.servicioId || null;
  if (payload.activa !== undefined) cambios.Estado = payload.activa;

  const { data, error } = await supabase
    .from("Promocion")
    .update(cambios)
    .eq("ID", id)
    .select(PROMOCION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapPromocion(data as unknown as PromocionRaw);
}

export async function eliminarPromocion(id: string): Promise<void> {
  const { error } = await supabase.from("Promocion").delete().eq("ID", id);
  if (error) throw new Error(error.message);
}

export async function toggleActivarPromocion(id: string): Promise<Promocion> {
  const existente = (await obtenerPromociones()).find((promocion) => promocion.id === id);
  if (!existente) throw new Error("Promoción no encontrada.");
  return actualizarPromocion(id, { activa: !existente.activa });
}
