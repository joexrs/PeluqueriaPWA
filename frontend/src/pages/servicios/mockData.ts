import type { Servicio } from "./types";

export const SERVICIOS_INICIALES: Servicio[] = [
  { id: "s1", nombre: "Corte y lavado", tipo: "Corte", precio: 30, duracion: 45 },
  { id: "s2", nombre: "Coloración completa", tipo: "Color", precio: 80, duracion: 90 },
  { id: "s3", nombre: "Limpieza facial", tipo: "Tratamiento", precio: 45, duracion: 40 },
  { id: "s4", nombre: "Peinado de novia", tipo: "Peinado", precio: 120, duracion: 60 },
];
