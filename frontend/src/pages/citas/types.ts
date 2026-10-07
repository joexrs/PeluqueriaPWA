// Tipos para las tablas de Citas segun schema.sql
// Usamos un tipo permisivo para compatibilidad

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cita = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cita_Servicio = Record<string, any>;

export interface CitaConDetalle {
  ID: string;
  id: string;
  cliente_id: string;
  trabajador_id: string | null;
  fecha_cita: string;
  hora_inicio: string;
  hora_fin: string;
  Estado: boolean;
  Cliente: {
    ID: string;
    Nombre: string;
    Apellido: string;
    Telefono: string;
  } | null;
  servicios: Array<{
    servicio_id: string;
    trabajador_id: string | null;
    orden: number;
    Cantidad: number;
    precio_aplicado: number;
    duracion_minutos: number;
    Servicio: {
      Nombre: string;
      Precio: number;
      Duracion_minutos: number;
    } | null;
    nombre?: string;
  }>;
  // Aliases de compatibilidad con la UI legacy
  cliente?: {
    id?: string;
    nombre?: string;
    apellido?: string | null;
    telefono?: string | null;
    Nombre?: string;
    Apellido?: string | null;
    Telefono?: string | null;
  } | null;
  trabajador?: {
    id?: string;
    nombre?: string;
    apellido?: string | null;
  } | null;
  fecha?: string;
  estado: EstadoCita;
  codigo_cita: string;
  monto_estimado: number;
  notas: string | null;
}

export interface CrearCitaPayload {
  cliente_id: string;
  trabajador_id?: string | null;
  fecha_cita?: string;
  fecha?: string;
  hora_inicio: string;
  hora_fin: string;
  estado?: EstadoCita | boolean;
  Estado?: boolean;
  origen?: OrigenCita;
  notas?: string | null;
  servicios: Array<{
    servicio_id: string;
    trabajador_id?: string | null;
    orden?: number;
    Cantidad?: number;
    precio_aplicado?: number;
    duracion_minutos?: number;
  }>;
}

export interface FiltroCitas {
  fecha?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  clienteId?: string;
  trabajadorId?: string;
  soloActivas?: boolean;
}

// ==================== TIPOS LEGACY PARA COMPATIBILIDAD ====================

export type EstadoCita = "PENDIENTE" | "CONFIRMADA" | "EN_ATENCION" | "COMPLETADA" | "CANCELADA" | "NO_SHOW";
export type OrigenCita = "PWA_RECEPCION" | "WHATSAPP_BOT" | "LLAMADA" | "WEB_PUBLICA";

export type CategoriaCita = "hair" | "nails" | "skin";
export type Especialista = "Todos" | "Elena" | "Carlos" | "Dra. Soto";

export interface CitaAgenda {
  id: string;
  day: number;
  title: string;
  staff: Exclude<Especialista, "Todos">;
  category: CategoriaCita;
  time: string;
  client: string;
  top: number;
  left: number;
}

export interface CitaRow {
  id: string;
  codigo_cita: string;
  cliente_id: string;
  trabajador_id: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoCita;
  origen: OrigenCita;
  monto_estimado: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface DetalleCitaServicioRow {
  id: string;
  cita_id: string;
  servicio_id: string;
  precio_aplicado: number;
  duracion_minutos: number;
}

export interface CrearCitaPayloadLegacy {
  cliente_id: string;
  trabajador_id?: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado?: EstadoCita;
  origen?: OrigenCita;
  notas?: string | null;
  servicios: Array<{
    servicio_id: string;
    precio_aplicado: number;
    duracion_minutos: number;
  }>;
}

export interface ActualizarCitaPayload {
  trabajador_id?: string | null;
  fecha?: string;
  hora_inicio?: string;
  hora_fin?: string;
  estado?: EstadoCita;
  notas?: string | null;
  servicios?: Array<{
    servicio_id: string;
    precio_aplicado: number;
    duracion_minutos: number;
  }>;
}