import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BadgeDollarSign,
  CalendarDays,
  Clock3,
  TriangleAlert,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { obtenerDashboardData } from "./dashboardService";
import type { DashboardData, ProximaCita } from "./types";
import "./dashboard.css";

// ─── Helpers de formato ───────────────────────────────────────────────────────

function formatHora(hora: string): string {
  const [h, m] = hora.split(":");
  const num = parseInt(h, 10);
  const ampm = num >= 12 ? "PM" : "AM";
  const hora12 = num % 12 === 0 ? 12 : num % 12;
  return `${hora12}:${m} ${ampm}`;
}

function formatMonto(val: number): string {
  return `S/ ${val.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const ESTADO_TAG: Record<string, { label: string; cls: string }> = {
  PENDIENTE: { label: "Pendiente", cls: "tag-warning" },
  CONFIRMADA: { label: "Confirmada", cls: "tag-success" },
  EN_ATENCION: { label: "En atención", cls: "tag-info" },
  NO_SHOW: { label: "No show", cls: "tag-error" },
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accentClass?: string;
  nota?: string;
}

function KpiCard({ label, value, icon, accentClass = "", nota }: KpiCardProps) {
  return (
    <div className="kpi-card-new">
      <div className="kpi-card-header">
        <span className="kpi-label">{label}</span>
        <span className={`kpi-icon-wrap ${accentClass}`}>{icon}</span>
      </div>
      <div className="kpi-number">{value}</div>
      {nota && <div className="kpi-nota">{nota}</div>}
    </div>
  );
}

function CitaRow({ cita }: { cita: ProximaCita }) {
  const estado = ESTADO_TAG[cita.estado] ?? { label: cita.estado, cls: "tag-neutral" };
  const nombre = [cita.cliente_nombre, cita.cliente_apellido].filter(Boolean).join(" ");
  const trabajador = cita.trabajador_nombre
    ? [cita.trabajador_nombre, cita.trabajador_apellido].filter(Boolean).join(" ")
    : "Sin asignar";
  const iniciales = trabajador.slice(0, 2).toUpperCase();
  const color = cita.trabajador_color ?? "#7A2E45";

  return (
    <div className="cita-row">
      <div className="cita-hora">
        <strong>{formatHora(cita.hora_inicio).split(" ")[0]}</strong>
        <small>{formatHora(cita.hora_inicio).split(" ")[1]}</small>
      </div>
      <div className="cita-accent-bar" style={{ background: color }} />
      <div className="cita-info">
        <strong>{nombre}</strong>
        <span>{cita.servicios_resumen}</span>
      </div>
      <div className="cita-trabajador">
        <div className="avatar-mini" style={{ background: `${color}22`, color }}>
          {iniciales}
        </div>
        <span>{trabajador}</span>
      </div>
      <span className={`dash-tag ${estado.cls}`}>{estado.label}</span>
    </div>
  );
}

// ─── Tooltip personalizado para recharts ──────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value">{formatMonto(payload[0].value)}</div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function cargar(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const d = await obtenerDashboardData();
      setData(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    obtenerDashboardData()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
        <p>Cargando dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dash-error">
        <TriangleAlert size={40} />
        <p>{error ?? "Error inesperado."}</p>
        <button className="btn btn-primary" onClick={() => cargar()}>Reintentar</button>
      </div>
    );
  }

  const { kpis, proximasCitas, ventasSemana } = data;

  return (
    <div className="dash-page">
      {/* ── Encabezado ─────────────────────────────────────────── */}
      <header className="dash-header">
        <div>
          <p className="eyebrow">Resumen del día</p>
          <h2>Dashboard</h2>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => cargar(true)}
          disabled={refreshing}
          title="Actualizar"
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          <span>Actualizar</span>
        </button>
      </header>

      {/* ── KPIs ───────────────────────────────────────────────── */}
      <section className="kpis-row" aria-label="KPIs">
        <KpiCard
          label="Citas de hoy"
          value={kpis.citasHoy}
          icon={<CalendarDays size={17} strokeWidth={2} />}
          accentClass="kpi-gold"
          nota="Activas (excl. canceladas)"
        />
        <KpiCard
          label="Ventas del día"
          value={formatMonto(kpis.ventasHoy)}
          icon={<BadgeDollarSign size={17} strokeWidth={2} />}
          accentClass="kpi-green"
        />
        <KpiCard
          label="Alertas inventario"
          value={kpis.alertasInventario}
          icon={<TriangleAlert size={17} strokeWidth={2} />}
          accentClass={kpis.alertasInventario > 0 ? "kpi-red" : "kpi-muted"}
          nota={kpis.alertasInventario === 0 ? "Todo en orden" : "Stock bajo mínimo"}
        />
        <KpiCard
          label="Por confirmar"
          value={kpis.citasPorConfirmar}
          icon={<Clock3 size={17} strokeWidth={2} />}
          accentClass="kpi-purple"
          nota="Citas pendientes"
        />
      </section>

      {/* ── Contenido principal ────────────────────────────────── */}
      <div className="dash-content">

        {/* Próximas citas */}
        <section className="dash-panel dash-panel-wide">
          <div className="dash-panel-head">
            <h3>Próximas citas</h3>
            <button
              className="btn-link"
              onClick={() => navigate("/citas")}
            >
              Ver agenda <ArrowRight size={14} />
            </button>
          </div>

          {proximasCitas.length === 0 ? (
            <div className="dash-empty">
              <CalendarDays size={36} opacity={0.3} />
              <p>No hay citas pendientes para hoy</p>
            </div>
          ) : (
            <div className="citas-list">
              {proximasCitas.map((c) => (
                <CitaRow key={c.id} cita={c} />
              ))}
            </div>
          )}
        </section>

        {/* Gráfico semanal */}
        <aside className="dash-panel">
          <div className="dash-panel-head">
            <h3>Ventas — 7 días</h3>
          </div>

          {ventasSemana.every((v) => v.total === 0) ? (
            <div className="dash-empty">
              <BadgeDollarSign size={36} opacity={0.3} />
              <p>Sin ventas registradas esta semana</p>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={ventasSemana}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ventasGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7A2E45" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7A2E45" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(122,46,69,0.08)" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 11, fill: "#A98A93", fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#A98A93" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `S/${v}`}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#7A2E45"
                    strokeWidth={2.5}
                    fill="url(#ventasGrad)"
                    dot={{ fill: "#7A2E45", r: 4, strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, fill: "#C9A227" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
