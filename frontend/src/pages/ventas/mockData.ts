import type { VentaCita } from "./types";

export const VENTAS_INICIALES: VentaCita[] = [
  {
    id: "v1",
    citaId: "cita-101",
    clienteNombre: "Ana García",
    servicios: [
      { id: "s1", nombre: "Corte y lavado", precio: 30, duracion: 45 },
      { id: "s2", nombre: "Coloración completa", precio: 80, duracion: 90 },
    ],
    productos: [],
    metodoPago: null,
    pagada: false,
    total: 110,
    fecha: "2026-09-02",
  },
];
