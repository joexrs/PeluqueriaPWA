import type { DashboardResumen } from "./types";
import { DASHBOARD_RESUMEN_INICIAL } from "./mockData";

const dashboard: DashboardResumen = {
  ...DASHBOARD_RESUMEN_INICIAL,
  proximasCitas: DASHBOARD_RESUMEN_INICIAL.proximasCitas.map((cita) => ({ ...cita })),
  tendenciasVenta: [...DASHBOARD_RESUMEN_INICIAL.tendenciasVenta],
};

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export async function obtenerDashboardResumen(): Promise<DashboardResumen> {
  await esperar();

  return {
    ...dashboard,
    proximasCitas: dashboard.proximasCitas.map((cita) => ({ ...cita })),
    tendenciasVenta: [...dashboard.tendenciasVenta],
  };
}
