export type RolUsuario = "admin" | "empleado" | "recepcionista";

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}
