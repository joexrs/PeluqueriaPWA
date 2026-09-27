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

// Compatibilidad con mocks legacy que aún importan `Servicio`.
export interface Servicio {
  id: string;
  nombre: string;
  tipo: string;
  precio: number;
  duracion: number;
}
