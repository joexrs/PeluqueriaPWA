import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import { obtenerDashboardResumen } from "./dashboardService";
import type { DashboardResumen } from "./types";

export default function DashboardPage() {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function cargarResumen() {
      try {
        setLoading(true);
        const data = await obtenerDashboardResumen();
        if (!cancelled) {
          setResumen(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void cargarResumen();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏳</div>
        <strong>Cargando dashboard...</strong>
      </div>
    );
  }

  if (error || !resumen) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <strong>{error ?? "No se pudo cargar el resumen."}</strong>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Resumen</p>
          <h2>Dashboard</h2>
        </div>
      </div>

      <div className="kpis-grid">
        <div className="kpi-card">
          <div className="kpi-topline">
            <span>Citas de hoy</span>
            <span className="kpi-icon accent"><CalendarDays size={16} strokeWidth={2} /></span>
          </div>
          <div className="kpi-value">{resumen.citasHoy}</div>
          <div className="kpi-foot"><strong>+4</strong> vs ayer</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-topline">
            <span>Ventas del día</span>
            <span className="kpi-icon accent"><BadgeDollarSign size={16} strokeWidth={2} /></span>
          </div>
          <div className="kpi-value">${resumen.ventasHoy.toLocaleString("es-ES")}</div>
          <div className="kpi-foot"><strong>+12%</strong> vs ayer</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-topline">
            <span>Alertas inventario</span>
            <span className="kpi-icon"><TriangleAlert size={16} strokeWidth={2} /></span>
          </div>
          <div className="kpi-value">{resumen.alertasInventario}</div>
          <div className="kpi-foot">Items críticos</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-topline">
            <span>Citas por confirmar</span>
            <span className="kpi-icon accent"><Clock3 size={16} strokeWidth={2} /></span>
          </div>
          <div className="kpi-value">{resumen.citasPorConfirmar}</div>
          <div className="kpi-foot">Requieren seguimiento</div>
        </div>
      </div>

      <div className="dashboard-content">
        <section className="panel panel-wide">
          <div className="panel-header">
            <h3>Próximas citas</h3>
            <button className="button-link">Ver agenda</button>
          </div>

          <div className="list-stack">
            {resumen.proximasCitas.map((cita) => (
              <div key={cita.id} className={`row-item ${cita.id === "cita-3" ? "featured" : ""}`}>
                <div className={`row-time ${cita.color === "accent" ? "highlight" : ""}`}>
                  <strong>{cita.hora.split(":")[0]}</strong>
                  <small>{cita.hora.includes("PM") ? "PM" : "AM"}</small>
                </div>
                <div className={`row-line ${cita.color === "gold" ? "line-gold" : cita.color === "rose" ? "line-rose" : "line-accent"}`} />
                <div className="row-main">
                  <strong>{cita.cliente}</strong>
                  <span>{cita.servicio}</span>
                </div>
                <div className="row-meta">
                  <span className="avatar tiny">{cita.profesional.slice(0, 2).toUpperCase()}</span>
                  <span>{cita.profesional}</span>
                </div>
                <span className={`tag ${cita.estado === "Confirmada" ? "success" : cita.estado === "En espera" ? "neutral" : "warning"}`}>
                  {cita.estado}
                </span>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel">
          <div className="panel-header">
            <h3>Tendencias de venta</h3>
            <span className="muted">Esta semana</span>
          </div>

          <div className="chart-wrap">
            <div className="chart-grid" />
            <div className="bars">
              {resumen.tendenciasVenta.map((height, index) => (
                <div key={index} className="bar-col">
                  <div className="bar" style={{ height: `${height}%` }} />
                  <span>{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][index]}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
