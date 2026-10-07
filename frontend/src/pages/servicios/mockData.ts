import type { Servicio } from "./types";

// Mock data para desarrollo sin conexion a BD
export const SERVICIOS_INICIALES: Servicio[] = [
  { ID: "s1", Nombre: "Corte caballero", Descripcion: "Corte clásico de caballero", Precio: 25, Duracion_minutos: 30, Estado: true },
  { ID: "s2", Nombre: "Corte damas", Descripcion: "Corte y peinado para damas", Precio: 35, Duracion_minutos: 45, Estado: true },
  { ID: "s3", Nombre: "Barba", Descripcion: "Perfilado de barba", Precio: 15, Duracion_minutos: 20, Estado: true },
  { ID: "s4", Nombre: "Tintura", Descripcion: "Tintura completa", Precio: 50, Duracion_minutos: 90, Estado: true },
];