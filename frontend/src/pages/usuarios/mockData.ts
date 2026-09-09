import type { Usuario } from "./types";

export const USUARIOS_INICIALES: Usuario[] = [
  { id: "u1", nombre: "Marta", apellido: "López", email: "marta@salon.com", rol: "admin", activo: true },
  { id: "u2", nombre: "Sofía", apellido: "Ruiz", email: "sofia@salon.com", rol: "empleado", activo: true },
  { id: "u3", nombre: "Lucía", apellido: "Vega", email: "lucia@salon.com", rol: "recepcionista", activo: false },
];
