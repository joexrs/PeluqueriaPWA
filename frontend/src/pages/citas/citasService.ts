/**
 * citasService.ts — acceso directo a las tablas de Citas segun schema.sql
 */
import { supabase } from "../../lib/supabaseClient";
import type {
  CitaAgenda,
  CitaConDetalle,
  CrearCitaPayload,
  FiltroCitas,
  EstadoCita,
} from "./types";

// Interfaces Raw de Supabase
interface ClienteRaw {
  ID: unknown;
  Nombre: unknown;
  Apellido: unknown;
  Telefono: unknown;
}

interface Cita_ServicioRaw {
  ID: unknown;
  cita_id: unknown;
  servicio_id: unknown;
  trabajador_id: unknown;
  orden: unknown;
  Cantidad: unknown;
  Servicio: unknown;
  Trabajador: unknown;
}

interface ServicioRaw {
  ID: unknown;
  Nombre: unknown;
  Precio: unknown;
  Duracion_minutos: unknown;
}

const ESTADOS_CITA: EstadoCita[] = ["PENDIENTE", "CONFIRMADA", "EN_ATENCION", "COMPLETADA", "CANCELADA", "NO_SHOW"];

/** Lee el estado nuevo y conserva lectura compatible con filas antiguas. */
function mapEstadoCita(raw: Record<string, unknown>): EstadoCita {
  const estado = String(raw.Estado_Cita ?? "").toUpperCase();
  if (ESTADOS_CITA.includes(estado as EstadoCita)) return estado as EstadoCita;
  return raw.Estado === false ? "CANCELADA" : "PENDIENTE";
}

/**
 * Mapea una fila cruda de Cliente
 */
function mapCliente(row: ClienteRaw) {
  return {
    ID: String(row.ID ?? ""),
    Nombre: String(row.Nombre ?? ""),
    Apellido: row.Apellido ? String(row.Apellido) : "",
    Telefono: row.Telefono ? String(row.Telefono) : "",
  };
}

/**
 * Mapea una fila cruda de Cita_Servicio
 */
function mapCita_Servicio(row: Cita_ServicioRaw): CitaConDetalle["servicios"][0] {
  const serv = row.Servicio as ServicioRaw | null;
  const trabajadorRelacion = row.Trabajador as { Usuario?: { ID?: unknown; Nombre?: unknown; Apellido?: unknown; Color_agenda?: unknown } | null } | null;
  const usuario = trabajadorRelacion?.Usuario;
  const precio = Number(serv?.Precio ?? 0);
  const duracion = Number(serv?.Duracion_minutos ?? 30);
  const nombre = serv ? String(serv.Nombre ?? "") : "";
  return {
    servicio_id: String(row.servicio_id ?? ""),
    trabajador_id: row.trabajador_id ? String(row.trabajador_id) : null,
    orden: Number(row.orden ?? 1),
    Cantidad: Number(row.Cantidad ?? 1),
    precio_aplicado: precio,
    duracion_minutos: duracion,
    trabajador: usuario ? {
      id: String(usuario.ID ?? row.trabajador_id ?? ""),
      nombre: String(usuario.Nombre ?? ""),
      apellido: String(usuario.Apellido ?? ""),
      color_agenda: usuario.Color_agenda ? String(usuario.Color_agenda) : null,
    } : null,
    Servicio: serv ? {
      Nombre: nombre,
      Precio: precio,
      Duracion_minutos: duracion,
    } : null,
    nombre,
  };
}

/**
 * Obtiene citas con filtros
 */
export async function obtenerCitas(filtros: FiltroCitas = {}): Promise<CitaConDetalle[]> {
  let query = supabase
    .from("Cita")
    .select(`
      *,
      Cliente:Cliente!FK_Cita_Cliente(ID, Nombre, Apellido, Telefono),
      servicios:Cita_Servicio${filtros.trabajadorId ? "!inner" : ""}(
        ID,
        cita_id,
        servicio_id,
        trabajador_id,
        orden,
        Cantidad,
        Servicio:Servicio(ID, Nombre, Precio, Duracion_minutos),
        Trabajador:Trabajador_Servicio!FK_CitaServ_Trabajador_Servicio(
          Usuario:Usuario!FK_TrabajadorServicio_Usuario(ID, Nombre, Apellido, Color_agenda)
        )
      )
    `)
    .order("fecha_cita", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (filtros.fecha) {
    query = query.eq("fecha_cita", filtros.fecha);
  }
  if (filtros.fechaDesde) {
    query = query.gte("fecha_cita", filtros.fechaDesde);
  }
  if (filtros.fechaHasta) {
    query = query.lte("fecha_cita", filtros.fechaHasta);
  }
  if (filtros.clienteId) {
    query = query.eq("cliente_id", filtros.clienteId);
  }
  if (filtros.trabajadorId) {
    query = query.eq("servicios.trabajador_id", filtros.trabajadorId);
  }
  if (filtros.soloActivas !== false) {
    query = query.neq("Estado_Cita", "CANCELADA").neq("Estado_Cita", "NO_SHOW");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((raw: Record<string, unknown>) => {
    const cliente = raw.Cliente as ClienteRaw | null;
    const serviciosRaw = (raw.servicios ?? []) as Cita_ServicioRaw[];
    const servicios = serviciosRaw.map(mapCita_Servicio);
    const fecha = raw.fecha_cita ? String(raw.fecha_cita) : "";
    const estado = mapEstadoCita(raw);

    return {
      ID: String(raw.ID ?? ""),
      id: String(raw.ID ?? ""),
      cliente_id: String(raw.cliente_id ?? ""),
      trabajador_id: servicios[0]?.trabajador_id ?? null,
      fecha_cita: fecha,
      hora_inicio: raw.hora_inicio ? String(raw.hora_inicio) : "",
      hora_fin: raw.hora_fin ? String(raw.hora_fin) : "",
      Estado: raw.Estado !== false,
      Cliente: cliente ? mapCliente(cliente) : null,
      servicios,
      cliente: cliente ? {
        id: String(raw.cliente_id ?? ""),
        nombre: cliente.Nombre ? String(cliente.Nombre) : "",
        apellido: cliente.Apellido ? String(cliente.Apellido) : null,
        telefono: cliente.Telefono ? String(cliente.Telefono) : null,
      } : null,
      trabajador: servicios[0]?.trabajador ?? null,
      fecha,
      estado,
      codigo_cita: String(raw.ID ?? ""),
      monto_estimado: servicios.reduce((total, s) => total + Number(s.precio_aplicado ?? 0) * s.Cantidad, 0),
      notas: null,
    } satisfies CitaConDetalle;
  });
}

/**
 * Obtiene una cita por su ID
 */
export async function obtenerCitaPorId(id: string): Promise<CitaConDetalle> {
  const { data, error } = await supabase
    .from("Cita")
    .select(`
      *,
      Cliente:Cliente!FK_Cita_Cliente(ID, Nombre, Apellido, Telefono),
      servicios:Cita_Servicio(
        ID,
        cita_id,
        servicio_id,
        trabajador_id,
        orden,
        Cantidad,
        Servicio:Servicio(ID, Nombre, Precio, Duracion_minutos),
        Trabajador:Trabajador_Servicio!FK_CitaServ_Trabajador_Servicio(
          Usuario:Usuario!FK_TrabajadorServicio_Usuario(ID, Nombre, Apellido)
        )
      )
    `)
    .eq("ID", id)
    .single();

  if (error) throw new Error(error.message);

  const raw = data as Record<string, unknown>;
  const cliente = raw.Cliente as ClienteRaw | null;
  const serviciosRaw = (raw.servicios ?? []) as Cita_ServicioRaw[];
  const servicios = serviciosRaw.map(mapCita_Servicio);

  const fecha = raw.fecha_cita ? String(raw.fecha_cita) : "";
  const estado = mapEstadoCita(raw);

  return {
    ID: String(raw.ID ?? ""),
    id: String(raw.ID ?? ""),
    cliente_id: String(raw.cliente_id ?? ""),
    trabajador_id: servicios[0]?.trabajador_id ?? null,
    fecha_cita: fecha,
    hora_inicio: raw.hora_inicio ? String(raw.hora_inicio) : "",
    hora_fin: raw.hora_fin ? String(raw.hora_fin) : "",
    Estado: raw.Estado !== false,
    Cliente: cliente ? mapCliente(cliente) : null,
    servicios,
    cliente: cliente ? {
      id: String(raw.cliente_id ?? ""),
      nombre: cliente.Nombre ? String(cliente.Nombre) : "",
      apellido: cliente.Apellido ? String(cliente.Apellido) : null,
      telefono: cliente.Telefono ? String(cliente.Telefono) : null,
    } : null,
    trabajador: servicios[0]?.trabajador ?? null,
    fecha,
    estado,
    codigo_cita: String(raw.ID ?? ""),
    monto_estimado: servicios.reduce((total, s) => total + Number(s.precio_aplicado ?? 0) * s.Cantidad, 0),
    notas: null,
  } satisfies CitaConDetalle;
}

/**
 * Crea una cita con sus servicios
 */
export async function crearCita(payload: CrearCitaPayload): Promise<CitaConDetalle> {
  // RPC transaccional: nunca deja una cabecera de cita sin sus servicios.
  const { data, error } = await supabase.rpc("crear_cita_con_servicios", {
    p_cliente_id: Number(payload.cliente_id),
    p_fecha: payload.fecha_cita ?? payload.fecha,
    p_hora_inicio: payload.hora_inicio,
    p_hora_fin: payload.hora_fin,
    p_servicios: payload.servicios.map((servicio, index) => ({
      servicio_id: Number(servicio.servicio_id),
      trabajador_id: Number(servicio.trabajador_id ?? payload.trabajador_id),
      orden: servicio.orden ?? index + 1,
      cantidad: servicio.Cantidad ?? 1,
    })),
  });
  if (error) throw new Error(error.message);
  const citaId = String(data);
  return obtenerCitaPorId(String(citaId));
}

/**
 * Actualiza una cita existente
 */
export async function actualizarCita(
  id: string,
  cambios: Partial<CrearCitaPayload>
): Promise<CitaConDetalle> {
  const updateData: Record<string, unknown> = {};

  if (cambios.fecha_cita !== undefined) updateData.fecha_cita = cambios.fecha_cita;
  if (cambios.hora_inicio !== undefined) updateData.hora_inicio = cambios.hora_inicio;
  if (cambios.hora_fin !== undefined) updateData.hora_fin = cambios.hora_fin;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("Cita")
      .update(updateData)
      .eq("ID", id);

    if (error) throw new Error(error.message);
  }

  // Actualizar servicios si se proporcionan
  if (cambios.servicios !== undefined) {
    // Eliminar servicios existentes
    const { error: deleteError } = await supabase
      .from("Cita_Servicio")
      .delete()
      .eq("cita_id", id);

    if (deleteError) throw new Error(deleteError.message);

    // Insertar nuevos servicios
    if (cambios.servicios.length > 0) {
      const detalles = cambios.servicios.map((s, index) => ({
        cita_id: Number(id),
        servicio_id: s.servicio_id,
        trabajador_id: s.trabajador_id,
        orden: s.orden ?? index + 1,
        Cantidad: s.Cantidad ?? 1,
      }));

      const { error: insertError } = await supabase
        .from("Cita_Servicio")
        .insert(detalles);

      if (insertError) throw new Error(insertError.message);
    }
  }

  return obtenerCitaPorId(id);
}

/**
 * Cambia el estado de una cita (activar/desactivar)
 */
export async function cambiarEstadoCita(id: string, estado: EstadoCita): Promise<void> {
  const { error } = await supabase.rpc("cambiar_estado_cita", {
    p_cita_id: Number(id),
    p_estado: estado,
  });
  if (error) throw new Error(error.message);
}

/** Añade un servicio de forma transaccional y conserva los detalles previos. */
export async function agregarServicioEnCita(
  citaId: string,
  servicioId: string,
  trabajadorId: string,
): Promise<CitaConDetalle> {
  const { error } = await supabase.rpc("agregar_servicio_a_cita", {
    p_cita_id: Number(citaId),
    p_servicio_id: Number(servicioId),
    p_trabajador_id: Number(trabajadorId),
  });
  if (error) throw new Error(error.message);
  return obtenerCitaPorId(citaId);
}

/** Registra un producto dentro de la venta vinculada a la cita. */
export async function agregarProductoEnCita(
  citaId: string,
  productoId: string,
  cantidad: number,
): Promise<void> {
  const { error } = await supabase.rpc("agregar_producto_a_cita", {
    p_cita_id: Number(citaId),
    p_producto_id: Number(productoId),
    p_cantidad: cantidad,
  });
  if (error) throw new Error(error.message);
}

/** Descuenta del inventario un producto consumido en la atención, sin venderlo. */
export async function consumirProductoEnCita(
  citaId: string,
  productoId: string,
  cantidad: number,
): Promise<void> {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error("La cantidad debe ser un entero mayor que cero.");
  }
  const { error } = await supabase.rpc("consumir_producto_en_cita", {
    p_cita_id: Number(citaId),
    p_producto_id: Number(productoId),
    p_cantidad: cantidad,
  });
  if (error) throw new Error(error.message);
}

/**
 * Cancela una cita (desactiva)
 */
export async function cancelarCita(id: string): Promise<void> {
  await cambiarEstadoCita(id, "CANCELADA");
}

/**
 * Reactiva una cita cancelada
 */
export async function reactivarCita(id: string): Promise<void> {
  await cambiarEstadoCita(id, "PENDIENTE");
}

/**
 * Elimina una cita (borrado fisico - usar con cuidado)
 */
export async function eliminarCita(id: string): Promise<void> {
  const { error } = await supabase
    .from("Cita")
    .delete()
    .eq("ID", id);

  if (error) throw new Error(error.message);
}

/**
 * Obtiene las citas del dia actual
 */
export async function obtenerCitasDeHoy(): Promise<CitaConDetalle[]> {
  const hoy = new Date().toISOString().split("T")[0];
  return obtenerCitas({ fecha: hoy });
}

/**
 * Obtiene las citas de un cliente
 */
export async function obtenerCitasPorCliente(clienteId: string): Promise<CitaConDetalle[]> {
  return obtenerCitas({ clienteId });
}
// ==================== FUNCIONES DE COMPATIBILIDAD ====================

/**
 * Funcion legacy para compatibilidad con la agenda
 */
export async function obtenerCitasPorFiltro(params: {
  day?: number;
  staff?: string;
  services?: string[];
} = {}): Promise<CitaAgenda[]> {
  const todas = await obtenerCitas();

  return todas
    .map((cita, index) => {
    const fecha = new Date(`${cita.fecha_cita}T00:00:00`);
    const horaInicio = cita.hora_inicio || "09:00:00";
    const horaFin = cita.hora_fin || "10:00:00";
    const title = cita.servicios[0]?.Servicio?.Nombre || "Cita";

    return {
      id: cita.ID,
      day: fecha.getDate(),
      title,
      staff: "Elena" as const,
      category: "hair" as const,
      time: `${horaInicio.slice(0, 5)} - ${horaFin.slice(0, 5)}`,
      client: `${cita.Cliente?.Nombre || "Cliente"} ${cita.Cliente?.Apellido || ""}`.trim(),
      top: 64 + index * 36,
      left: (index % 5) * 14.285 + 14.285,
    };
    })
    .filter((cita) => params.day === undefined || cita.day === params.day)
    .filter((cita) => params.staff === undefined || cita.staff === params.staff)
    .filter((cita) => params.services === undefined || params.services.includes(cita.title));
}
