/**
 * citasService.ts
 * Única puerta de acceso a los datos de citas.
 * Los componentes nunca tocan supabase directamente.
 *
 * Tablas involucradas:
 *   citas                    — fila principal (hora_inicio / hora_fin, no un solo campo)
 *   detalle_citas_servicios  — servicios incluidos en cada cita
 *   clientes                 — join para mostrar nombre / teléfono
 *   usuarios                 — join para trabajador y su color_agenda
 *
 * NOTA: El trigger `recalcular_monto_cita` en Supabase actualiza
 * monto_estimado automáticamente cuando se insertan/eliminan filas
 * en detalle_citas_servicios, así que nunca lo calculamos aquí.
 */

import { supabase } from "../../lib/supabaseClient";
import type {
  CitaConDetalle,
  CitaRow,
  CrearCitaPayload,
  ActualizarCitaPayload,
  FiltroCitas,
  CitaAgenda,
  CategoriaCita,
  Especialista,
} from "./types";

// ─── Selector reutilizable con joins ─────────────────────────────────────────
//
// Traemos:
//   • todos los campos de `citas`
//   • cliente: nombre, apellido, telefono
//   • trabajador: nombre, apellido, color_agenda
//   • detalle_citas_servicios → join con servicios para obtener el nombre
//
const CITA_SELECT = `
  *,
  cliente:clientes ( id, nombre, apellido, telefono ),
  trabajador:usuarios!citas_trabajador_id_fkey ( id, nombre, apellido, color_agenda ),
  servicios:detalle_citas_servicios (
    id,
    servicio_id,
    precio_aplicado,
    duracion_minutos,
    servicio:servicios ( nombre )
  )
` as const;

// ─── Helper: aplana la respuesta de supabase al shape CitaConDetalle ──────────

function mapearCita(raw: Record<string, unknown>): CitaConDetalle {
  const serviciosRaw = (raw.servicios ?? []) as Array<{
    id: string;
    servicio_id: string;
    precio_aplicado: number;
    duracion_minutos: number;
    servicio: { nombre: string } | null;
  }>;

  return {
    ...(raw as unknown as CitaRow),
    cliente: raw.cliente as CitaConDetalle["cliente"],
    trabajador: raw.trabajador as CitaConDetalle["trabajador"],
    servicios: serviciosRaw.map((d) => ({
      servicio_id: d.servicio_id,
      nombre: d.servicio?.nombre ?? "Servicio eliminado",
      precio_aplicado: d.precio_aplicado,
      duracion_minutos: d.duracion_minutos,
    })),
  };
}

// ─── Obtener lista con filtros opcionales ─────────────────────────────────────

export async function obtenerCitas(
  filtros: FiltroCitas = {}
): Promise<CitaConDetalle[]> {
  let query = supabase
    .from("citas")
    .select(CITA_SELECT)
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (filtros.fecha) {
    query = query.eq("fecha", filtros.fecha);
  }
  if (filtros.fechaDesde) {
    query = query.gte("fecha", filtros.fechaDesde);
  }
  if (filtros.fechaHasta) {
    query = query.lte("fecha", filtros.fechaHasta);
  }
  if (filtros.trabajadorId) {
    query = query.eq("trabajador_id", filtros.trabajadorId);
  }
  if (filtros.estado) {
    query = query.eq("estado", filtros.estado);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) =>
    mapearCita(raw as Record<string, unknown>)
  );
}

// ─── Obtener una cita por ID ──────────────────────────────────────────────────

export async function obtenerCitaPorId(id: string): Promise<CitaConDetalle> {
  const { data, error } = await supabase
    .from("citas")
    .select(CITA_SELECT)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);

  return mapearCita(data as Record<string, unknown>);
}

// ─── Crear una cita + sus detalles (transacción manual) ──────────────────────
//
// Supabase no soporta transacciones client-side, así que:
//   1. Insertamos la cita.
//   2. Insertamos los detalles.
//   Si el paso 2 falla, lanzamos el error (la cita quedó sin detalles;
//   en producción esto debería resolverse con una Edge Function o RPC).

export async function crearCita(
  payload: CrearCitaPayload
): Promise<CitaConDetalle> {
  // 1. Insertar cita principal
  const { data: citaData, error: citaError } = await supabase
    .from("citas")
    .insert({
      cliente_id: payload.cliente_id,
      trabajador_id: payload.trabajador_id ?? null,
      fecha: payload.fecha,
      hora_inicio: payload.hora_inicio,
      hora_fin: payload.hora_fin,
      estado: payload.estado ?? "PENDIENTE",
      origen: payload.origen ?? "PWA_RECEPCION",
      notas: payload.notas ?? null,
    })
    .select("id")
    .single();

  if (citaError) throw new Error(citaError.message);

  const citaId = (citaData as { id: string }).id;

  // 2. Insertar detalles de servicios
  if (payload.servicios.length > 0) {
    const detalles = payload.servicios.map((s) => ({
      cita_id: citaId,
      servicio_id: s.servicio_id,
      precio_aplicado: s.precio_aplicado,
      duracion_minutos: s.duracion_minutos,
    }));

    const { error: detalleError } = await supabase
      .from("detalle_citas_servicios")
      .insert(detalles);

    if (detalleError) {
      throw new Error(
        `Cita creada (${citaId}) pero falló al guardar los servicios: ${detalleError.message}`
      );
    }
  }

  // 3. Devolver la cita completa con joins
  return obtenerCitaPorId(citaId);
}

// ─── Actualizar estado o datos básicos de una cita ───────────────────────────

export async function actualizarCita(
  id: string,
  cambios: ActualizarCitaPayload
): Promise<CitaConDetalle> {
  const { servicios, ...camposCita } = cambios;

  // Actualizar campos de la cita si los hay
  if (Object.keys(camposCita).length > 0) {
    const { error } = await supabase
      .from("citas")
      .update(camposCita)
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  // Reemplazar detalles si se proporcionan
  if (servicios !== undefined) {
    // Borrar detalles existentes
    const { error: borrarError } = await supabase
      .from("detalle_citas_servicios")
      .delete()
      .eq("cita_id", id);

    if (borrarError) throw new Error(borrarError.message);

    // Insertar nuevos detalles
    if (servicios.length > 0) {
      const detalles = servicios.map((s) => ({
        cita_id: id,
        servicio_id: s.servicio_id,
        precio_aplicado: s.precio_aplicado,
        duracion_minutos: s.duracion_minutos,
      }));

      const { error: insertarError } = await supabase
        .from("detalle_citas_servicios")
        .insert(detalles);

      if (insertarError) throw new Error(insertarError.message);
    }
  }

  return obtenerCitaPorId(id);
}

// ─── Cambiar solo el estado de una cita (acción rápida desde agenda) ─────────

export async function cambiarEstadoCita(
  id: string,
  estado: import("./types").EstadoCita
): Promise<void> {
  const { error } = await supabase
    .from("citas")
    .update({ estado })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ─── Eliminar una cita (y sus detalles, ON DELETE CASCADE en la BD) ───────────

export async function eliminarCita(id: string): Promise<void> {
  const { error } = await supabase.from("citas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Helpers de conveniencia ──────────────────────────────────────────────────

/**
 * Devuelve las citas del día actual (fecha local del navegador).
 */
export async function obtenerCitasDeHoy(): Promise<CitaConDetalle[]> {
  const hoy = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  return obtenerCitas({ fecha: hoy });
}

/**
 * Devuelve las citas de una semana (lunes → domingo) dado un Date cualquiera
 * dentro de esa semana.
 */
export async function obtenerCitasDeSemana(
  fechaReferencia: Date
): Promise<CitaConDetalle[]> {
  const dia = fechaReferencia.getDay(); // 0 = domingo
  const diffLunes = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(fechaReferencia);
  lunes.setDate(lunes.getDate() + diffLunes);
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);

  const toISO = (d: Date) => d.toISOString().split("T")[0];

  return obtenerCitas({ fechaDesde: toISO(lunes), fechaHasta: toISO(domingo) });
}

// Compatibilidad mínima para la agenda legacy que aún consume CitasPage.tsx.
export async function obtenerCitasPorFiltro(params: {
  day?: number;
  staff?: Especialista;
  services?: CategoriaCita[];
} = {}): Promise<CitaAgenda[]> {
  const todas = await obtenerCitas();

  const resolverCategoria = (cita: CitaConDetalle): CategoriaCita => {
    const nombreServicio = cita.servicios[0]?.nombre?.toLowerCase() ?? "";
    if (nombreServicio.includes("uñas") || nombreServicio.includes("manicura") || nombreServicio.includes("pedicura")) return "nails";
    if (nombreServicio.includes("piel") || nombreServicio.includes("facial") || nombreServicio.includes("limpieza")) return "skin";
    return "hair";
  };

  const resolverStaff = (cita: CitaConDetalle): Exclude<Especialista, "Todos"> => {
    const nombre = cita.trabajador?.nombre?.toLowerCase() ?? "";
    const apellido = cita.trabajador?.apellido?.toLowerCase() ?? "";

    if (nombre.includes("elena") || apellido.includes("elena")) return "Elena";
    if (nombre.includes("carlos") || apellido.includes("carlos")) return "Carlos";
    if (nombre.includes("soto") || apellido.includes("soto") || nombre.includes("dra") || apellido.includes("soto")) return "Dra. Soto";
    return "Elena";
  };

  return todas
    .filter((cita) => {
      const day = Number((cita.fecha ?? "").split("-")[2] ?? 0);
      const matchesDay = params.day ? day === params.day : true;
      const matchesStaff = params.staff && params.staff !== "Todos" ? resolverStaff(cita) === params.staff : true;
      const matchesService = params.services && params.services.length > 0 ? params.services.includes(resolverCategoria(cita)) : true;
      return matchesDay && matchesStaff && matchesService;
    })
    .map((cita, index) => {
      const fecha = new Date(`${cita.fecha}T00:00:00`);
      const horaInicio = cita.hora_inicio ?? "09:00:00";
      const horaFin = cita.hora_fin ?? "10:00:00";
      const category = resolverCategoria(cita);
      const staff = resolverStaff(cita);

      return {
        id: cita.id,
        day: fecha.getDate(),
        title: cita.servicios[0]?.nombre ?? "Cita",
        staff,
        category,
        time: `${horaInicio.slice(0, 5)} - ${horaFin.slice(0, 5)}`,
        client: `${cita.cliente?.nombre ?? "Cliente"} ${cita.cliente?.apellido ?? ""}`.trim(),
        top: 64 + index * 36,
        left: (index % 5) * 14.285 + 14.285,
      } satisfies CitaAgenda;
    });
}

