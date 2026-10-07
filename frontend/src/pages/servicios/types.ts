// Tipos para la tabla "Servicio" segun schema.sql de Supabase
export interface CategoriaServicio {
  // Nuevos nombres
  ID: string;
  Nombre: string;
  Descripcion?: string | null;
  Estado?: boolean;
  
  // Alias de compatibilidad
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  color?: string | null;
}

export interface Servicio {
  // Nuevos nombres (schema.sql)
  ID: string;
  Nombre: string;
  Descripcion?: string | null;
  Precio: number;
  Duracion_minutos: number;
  Categoria_id?: string | null;
  Estado?: boolean;
  Created_at?: string;
  Updated_at?: string;
  Categoria_Servicio?: CategoriaServicio | null;
  
  // Alias de compatibilidad para la UI existente
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  precio_base?: number;
  precio?: number;
  duracion_minutos?: number;
  duracion?: number;
  categoria_id?: string | null;
  tiempo_limpieza_minutos?: number;
  activo?: boolean;
  categoria?: CategoriaServicio | null;
}

// Payload para crear/actualizar servicio
export interface CrearServicioPayload {
  // Nuevos nombres
  Nombre?: string;
  Descripcion?: string | null;
  Precio?: number;
  Duracion_minutos?: number;
  Categoria_id?: string | null;
  
  // Alias de compatibilidad
  nombre?: string;
  descripcion?: string | null;
  precio_base?: number;
  duracion_minutos?: number;
  categoria_id?: string | null;
}

// Compatibilidad con mocks legacy
export interface ServicioLegacy {
  id: string;
  nombre: string;
  tipo: string;
  precio: number;
  duracion: number;
}