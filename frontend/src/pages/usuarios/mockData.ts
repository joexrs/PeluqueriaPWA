import type { Usuario } from "./types";

// Mock data para desarrollo sin conexion a BD
export const USUARIOS_INICIALES: Usuario[] = [
  { ID: "u1", Nombre: "Marta", Apellido: "López", E_mail: "marta@salon.com", Usuario: "marta", Rol_id: 1, Estado: true, color_agenda: "#FF0000", comision_porcentaje: 0 },
  { ID: "u2", Nombre: "Sofía", Apellido: "Ruiz", E_mail: "sofia@salon.com", Usuario: "sofia", Rol_id: 4, Estado: true, color_agenda: "#00FF00", comision_porcentaje: 30 },
  { ID: "u3", Nombre: "Lucía", Apellido: "Vega", E_mail: "lucia@salon.com", Usuario: "lucia", Rol_id: 3, Estado: false, color_agenda: "#0000FF", comision_porcentaje: 0 },
];