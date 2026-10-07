// Tipos para la tabla "Cliente" segun schema.sql
// Usamos un tipo permisivo para compatibilidad

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cliente = Record<string, any>;

export interface CrearClientePayload {
  // Nuevos nombres
  Nombre?: string;
  Apellido?: string;
  Telefono?: string | null;
  E_mail?: string | null;
  DNI?: string | null;
  Fecha_Nacimiento?: string | null;
  Preferencias?: Record<string, unknown> | null;

  // Alias de compatibilidad
  nombre?: string;
  apellido?: string | null;
  telefono?: string;
  email?: string | null;
  dni?: string | null;
  fecha_nacimiento?: string | null;
  notas_preferencias?: string | null;
}