import type { Cliente } from "./types";

// Mock data para desarrollo sin conexion a BD
export const CLIENTES_INICIALES: Cliente[] = [
  { ID: "c1", Nombre: "Juan", Apellido: "Pérez", Telefono: "999888777", E_mail: "juan@correo.com", Estado: true },
  { ID: "c2", Nombre: "María", Apellido: "García", Telefono: "999666555", E_mail: "maria@correo.com", Estado: true },
  { ID: "c3", Nombre: "Pedro", Apellido: "Rodríguez", Telefono: "999444333", E_mail: "pedro@correo.com", Estado: false },
];