import type { DashboardResumen } from "./types";

export const DASHBOARD_RESUMEN_INICIAL: DashboardResumen = {
  citasHoy: 24,
  ventasHoy: 1850,
  alertasInventario: 3,
  citasPorConfirmar: 5,
  proximasCitas: [
    {
      id: "cita-1",
      hora: "10:00 AM",
      cliente: "María Fernández",
      servicio: "Corte + Tinte",
      profesional: "Ana S.",
      estado: "Confirmada",
      color: "gold",
    },
    {
      id: "cita-2",
      hora: "11:30 AM",
      cliente: "Lucía Gómez",
      servicio: "Manicura Spa",
      profesional: "Carlos R.",
      estado: "En espera",
      color: "rose",
    },
    {
      id: "cita-3",
      hora: "12:15 PM",
      cliente: "Elena Torres",
      servicio: "Maquillaje Social",
      profesional: "Sofía M.",
      estado: "En progreso",
      color: "accent",
    },
  ],
  tendenciasVenta: [40, 55, 45, 65, 85, 95, 0],
};
