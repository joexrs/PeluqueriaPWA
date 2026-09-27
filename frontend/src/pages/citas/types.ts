// ─── Enums que coinciden con los tipos USER-DEFINED de Supabase ───────────────

export type EstadoCita =
  | "PENDIENTE"
  | "CONFIRMADA"
  | "EN_ATENCION"
  | "COMPLETADA"
  | "CANCELADA"
  | "NO_SHOW";

export type OrigenCita =
  | "PWA_RECEPCION"
  | "WHATSAPP_BOT"
  | "LLAMADA"
  | "WEB_PUBLICA";

// ─── Fila cruda de Supabase (tabla `citas`) ───────────────────────────────────

export interface CitaRow {
  id: string;
  codigo_cita: string;
  cliente_id: string;
  trabajador_id: string | null;
  fecha: string;          // "YYYY-MM-DD"
  hora_inicio: string;    // "HH:MM:SS"
  hora_fin: string;       // "HH:MM:SS"
  estado: EstadoCita;
  origen: OrigenCita;
  monto_estimado: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Fila cruda de `detalle_citas_servicios` ──────────────────────────────────

export interface DetalleCitaServicioRow {
  id: string;
  cita_id: string;
  servicio_id: string;
  precio_aplicado: number;
  duracion_minutos: number;
}

// ─── DTO enriquecido que el servicio devuelve al componente ───────────────────

export interface CitaConDetalle extends CitaRow {
  cliente?: {
    id: string;
    nombre: string;
    apellido: string | null;
    telefono: string;
  };
  trabajador?: {
    id: string;
    nombre: string;
    apellido: string;
    color_agenda: string;
  } | null;
  servicios: Array<{
    servicio_id: string;
    nombre: string;
    precio_aplicado: number;
    duracion_minutos: number;
  }>;
}

// ─── Payload para crear / actualizar una cita ─────────────────────────────────

export interface CrearCitaPayload {
  cliente_id: string;
  trabajador_id?: string | null;
  fecha: string;          // "YYYY-MM-DD"
  hora_inicio: string;    // "HH:MM"
  hora_fin: string;       // "HH:MM"
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

// ─── Filtros para la vista de agenda ─────────────────────────────────────────

export interface FiltroCitas {
  fecha?: string;          // "YYYY-MM-DD" — filtra por día exacto
  fechaDesde?: string;     // rango desde
  fechaHasta?: string;     // rango hasta
  trabajadorId?: string;
  estado?: EstadoCita;
}

// Compatibilidad mínima con la agenda legacy usada por CitasPage.tsx
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

