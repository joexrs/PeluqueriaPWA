// ─── KPIs ─────────────────────────────────────────────────────────────────────

export interface KpiDashboard {
  citasHoy: number;
  ventasHoy: number;        // monto_total sum del día
  alertasInventario: number; // productos con stock <= stock_minimo
  citasPorConfirmar: number; // estado = PENDIENTE
}

// ─── Ítem de la lista de próximas citas ───────────────────────────────────────

export interface ProximaCita {
  id: string;
  hora_inicio: string;       // "HH:MM:SS"
  cliente_nombre: string;
  cliente_apellido: string | null;
  trabajador_nombre: string | null;
  trabajador_apellido: string | null;
  trabajador_color: string | null;
  servicios_resumen: string; // "Corte, Tinte" — nombres concatenados
  estado: string;
}

// ─── Punto para el gráfico semanal ────────────────────────────────────────────

export interface VentaSemana {
  dia: string;               // "Lun", "Mar", …
  fecha: string;             // "YYYY-MM-DD"
  total: number;
}

// ─── DTO completo del dashboard ───────────────────────────────────────────────

export interface DashboardData {
  kpis: KpiDashboard;
  proximasCitas: ProximaCita[];
  ventasSemana: VentaSemana[];
}

// Compatibilidad con datos legacy usados por mockData.ts
export interface DashboardResumen {
  citasHoy: number;
  ventasHoy: number;
  alertasInventario: number;
  citasPorConfirmar: number;
  proximasCitas: Array<{
    id: string;
    hora: string;
    cliente: string;
    servicio: string;
    profesional: string;
    estado: string;
    color: string;
  }>;
  tendenciasVenta: number[];
}
