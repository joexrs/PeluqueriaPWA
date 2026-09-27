export type RolUsuario = "admin" | "trabajador" | "recepcionista";

export interface Usuario {
  id: string;
  auth_id?: string | null;
  dni?: string | null;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  rol: RolUsuario;
  color_agenda?: string | null;
  comision_porcentaje?: number | null;
  activo: boolean;
}
