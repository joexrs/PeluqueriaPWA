export interface DashboardAgendaItem {
  id: string;
  hora: string;
  cliente: string;
  servicio: string;
  profesional: string;
  estado: "Confirmada" | "En espera" | "En progreso";
  color: "gold" | "rose" | "accent";
}

export interface DashboardResumen {
  citasHoy: number;
  ventasHoy: number;
  alertasInventario: number;
  citasPorConfirmar: number;
  proximasCitas: DashboardAgendaItem[];
  tendenciasVenta: number[];
}
