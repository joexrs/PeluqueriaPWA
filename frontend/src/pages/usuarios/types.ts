// Tipos para la tabla "Usuario" segun schema.sql de Supabase
// Usamos un tipo más permisivo para permitir compatibilidad

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Usuario = Record<string, any>;

export interface UsuarioFields {
  ID: string;
  DNI?: string | null;
  Nombre: string;
  Apellido: string;
  E_mail: string;
  Telefono?: string | null;
  Usuario?: string;
  Color_agenda?: string | null;
  Comision_porcentaje?: number | null;
  Rol_id?: number | null;
  Estado?: boolean;
  Created_at?: string;
  Updated_at?: string;
}

export interface CrearUsuarioPayload {
  DNI?: string | null;
  Nombre?: string;
  Apellido?: string;
  E_mail?: string;
  Telefono?: string | null;
  Usuario?: string;
  Color_agenda?: string | null;
  Comision_porcentaje?: number | null;
  Rol_id?: number | null;
  nombre?: string;
  apellido?: string;
  email?: string;
  usuario?: string;
  password?: string;
  rol_id?: number;
  telefono?: string | null;
  rol?: "admin" | "jefe" | "recepcionista" | "trabajador";
  color_agenda?: string | null;
  comision_porcentaje?: number | null;
  activo?: boolean;
  dni?: string | null;
  servicios_ids?: string[];
}
