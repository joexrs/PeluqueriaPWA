import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Package,
  Scissors,
  Download,
  Calendar,
  CreditCard,
  Smartphone,
  Banknote
} from "lucide-react";
import { obtenerReporteVentas, obtenerCuadreCaja, obtenerComisionesTrabajadores } from "./reportesService";
import type { ReporteVentas, CuadreCaja, ComisionTrabajador } from "./types";
import "./reportes.css";

export default function ReportesPage() {
  const [fechaInicio, setFechaInicio] = useState(() => {
    const hoy = new Date();
    hoy.setDate(1); // Primer día del mes
    return hoy.toISOString().split("T")[0];
  });

  const [fechaFin, setFechaFin] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [cuadre, setCuadre] = useState<CuadreCaja | null>(null);
  const [comisiones, setComisiones] = useState<ComisionTrabajador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaActiva, setVistaActiva] = useState<"general" | "cuadre" | "comisiones">("general");

  useEffect(() => {
    cargarReportes();
  }, [fechaInicio, fechaFin]);

  async function cargarReportes() {
    try {
      setLoading(true);
      setError(null);

      const [reporteData, cuadreData, comisionesData] = await Promise.all([
        obtenerReporteVentas(fechaInicio, fechaFin),
        obtenerCuadreCaja(fechaInicio, fechaFin),
        obtenerComisionesTrabajadores(fechaInicio, fechaFin),
      ]);

      setReporte(reporteData);
      setCuadre(cuadreData);
      setComisiones(comisionesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reportes");
    } finally {
      setLoading(false);
    }
  }

  function exportarCSV() {
    if (!reporte) return;

    const lineas = [
      "Reporte de Ventas",
      `Período: ${fechaInicio} al ${fechaFin}`,
      "",
      "RESUMEN GENERAL",
      `Total Ventas,S/ ${reporte.totalVentas.toFixed(2)}`,
      `Total Servicios,S/ ${reporte.totalServicios.toFixed(2)}`,
      `Total Productos,S/ ${reporte.totalProductos.toFixed(2)}`,
      `Cantidad de Ventas,${reporte.cantidadVentas}`,
      `Ticket Promedio,S/ ${reporte.ticketPromedio.toFixed(2)}`,
      "",
      "MÉTODOS DE PAGO",
      `Efectivo,S/ ${cuadre?.efectivo.toFixed(2) || "0.00"}`,
      `Yape,S/ ${cuadre?.yape.toFixed(2) || "0.00"}`,
      `Plin,S/ ${cuadre?.plin.toFixed(2) || "0.00"}`,
      `Tarjeta,S/ ${cuadre?.tarjeta.toFixed(2) || "0.00"}`,
      `Transferencia,S/ ${cuadre?.transferencia.toFixed(2) || "0.00"}`,
      "",
      "SERVICIOS MÁS VENDIDOS",
      "Servicio,Cantidad,Total",
      ...reporte.serviciosMasVendidos.map(
        (s) => `${s.nombre},${s.cantidad},S/ ${s.total.toFixed(2)}`
      ),
      "",
      "PRODUCTOS MÁS VENDIDOS",
      "Producto,Cantidad,Total",
      ...reporte.productosMasVendidos.map(
        (p) => `${p.nombre},${p.cantidad},S/ ${p.total.toFixed(2)}`
      ),
      "",
      "COMISIONES POR TRABAJADOR",
      "Trabajador,Servicios,Total Servicios,Comisión %,Comisión S/",
      ...comisiones.map(
        (c) =>
          `${c.nombre},${c.cantidadServicios},S/ ${c.totalServicios.toFixed(2)},${c.porcentajeComision}%,S/ ${c.montoComision.toFixed(2)}`
      ),
    ];

    const csv = lineas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-ventas-${fechaInicio}-${fechaFin}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="reportes-page">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <strong>Cargando reportes...</strong>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reportes-page">
        <div className="banner-error">{error}</div>
        <button className="btn btn-primary" onClick={() => void cargarReportes()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="reportes-page">
      <div className="reportes-header">
        <div>
          <h2>Reportes y Analytics</h2>
          <p className="page-subtitle">Analiza el desempeño del negocio</p>
        </div>
        <button className="btn btn-primary" onClick={exportarCSV}>
          <Download size={18} />
          Exportar CSV
        </button>
      </div>

      {/* Filtros de fecha */}
      <div className="reportes-filters">
        <div className="filter-group">
          <label>
            <Calendar size={16} />
            Fecha Inicio
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            max={fechaFin}
          />
        </div>
        <div className="filter-group">
          <label>
            <Calendar size={16} />
            Fecha Fin
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            min={fechaInicio}
            max={new Date().toISOString().split("T")[0]}
          />
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="reportes-tabs">
        <button
          className={`reportes-tab ${vistaActiva === "general" ? "active" : ""}`}
          onClick={() => setVistaActiva("general")}
        >
          <TrendingUp size={18} />
          Resumen General
        </button>
        <button
          className={`reportes-tab ${vistaActiva === "cuadre" ? "active" : ""}`}
          onClick={() => setVistaActiva("cuadre")}
        >
          <DollarSign size={18} />
          Cuadre de Caja
        </button>
        <button
          className={`reportes-tab ${vistaActiva === "comisiones" ? "active" : ""}`}
          onClick={() => setVistaActiva("comisiones")}
        >
          <Users size={18} />
          Comisiones
        </button>
      </div>

      {/* Contenido según vista activa */}
      {vistaActiva === "general" && reporte && (
        <div className="reportes-content">
          {/* KPIs principales */}
          <div className="kpis-grid">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#16a34a" }}>
                <DollarSign size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Total Ventas</span>
                <strong className="kpi-value">S/ {reporte.totalVentas.toFixed(2)}</strong>
                <small className="kpi-meta">{reporte.cantidadVentas} transacciones</small>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}>
                <Scissors size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Servicios</span>
                <strong className="kpi-value">S/ {reporte.totalServicios.toFixed(2)}</strong>
                <small className="kpi-meta">{reporte.serviciosMasVendidos.reduce((sum, s) => sum + s.cantidad, 0)} servicios</small>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(168, 85, 247, 0.1)", color: "#a855f7" }}>
                <Package size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Productos</span>
                <strong className="kpi-value">S/ {reporte.totalProductos.toFixed(2)}</strong>
                <small className="kpi-meta">{reporte.productosMasVendidos.reduce((sum, p) => sum + p.cantidad, 0)} unidades</small>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(251, 146, 60, 0.1)", color: "#fb923c" }}>
                <TrendingUp size={24} />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Ticket Promedio</span>
                <strong className="kpi-value">S/ {reporte.ticketPromedio.toFixed(2)}</strong>
                <small className="kpi-meta">por transacción</small>
              </div>
            </div>
          </div>

          {/* Servicios más vendidos */}
          <div className="reporte-section">
            <h3 className="section-title">
              <Scissors size={20} />
              Servicios Más Vendidos
            </h3>
            <div className="ranking-list">
              {reporte.serviciosMasVendidos.map((servicio, index) => (
                <div key={servicio.id} className="ranking-item">
                  <span className="ranking-position">#{index + 1}</span>
                  <div className="ranking-info">
                    <strong>{servicio.nombre}</strong>
                    <small>{servicio.cantidad} veces vendido</small>
                  </div>
                  <div className="ranking-stats">
                    <strong>S/ {servicio.total.toFixed(2)}</strong>
                    <div className="ranking-bar">
                      <div
                        className="ranking-bar-fill"
                        style={{
                          width: `${(servicio.total / reporte.totalServicios) * 100}%`,
                          background: "var(--color-accent)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Productos más vendidos */}
          <div className="reporte-section">
            <h3 className="section-title">
              <Package size={20} />
              Productos Más Vendidos
            </h3>
            <div className="ranking-list">
              {reporte.productosMasVendidos.map((producto, index) => (
                <div key={producto.id} className="ranking-item">
                  <span className="ranking-position">#{index + 1}</span>
                  <div className="ranking-info">
                    <strong>{producto.nombre}</strong>
                    <small>{producto.cantidad} unidades vendidas</small>
                  </div>
                  <div className="ranking-stats">
                    <strong>S/ {producto.total.toFixed(2)}</strong>
                    <div className="ranking-bar">
                      <div
                        className="ranking-bar-fill"
                        style={{
                          width: `${(producto.total / reporte.totalProductos) * 100}%`,
                          background: "var(--color-accent)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {vistaActiva === "cuadre" && cuadre && (
        <div className="reportes-content">
          <div className="cuadre-grid">
            <div className="cuadre-card">
              <div className="cuadre-icon" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#16a34a" }}>
                <Banknote size={28} />
              </div>
              <div className="cuadre-info">
                <span className="cuadre-label">Efectivo</span>
                <strong className="cuadre-amount">S/ {cuadre.efectivo.toFixed(2)}</strong>
                <small className="cuadre-percentage">
                  {((cuadre.efectivo / cuadre.total) * 100).toFixed(1)}% del total
                </small>
              </div>
            </div>

            <div className="cuadre-card">
              <div className="cuadre-icon" style={{ background: "rgba(168, 85, 247, 0.1)", color: "#a855f7" }}>
                <Smartphone size={28} />
              </div>
              <div className="cuadre-info">
                <span className="cuadre-label">Yape</span>
                <strong className="cuadre-amount">S/ {cuadre.yape.toFixed(2)}</strong>
                <small className="cuadre-percentage">
                  {((cuadre.yape / cuadre.total) * 100).toFixed(1)}% del total
                </small>
              </div>
            </div>

            <div className="cuadre-card">
              <div className="cuadre-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}>
                <Smartphone size={28} />
              </div>
              <div className="cuadre-info">
                <span className="cuadre-label">Plin</span>
                <strong className="cuadre-amount">S/ {cuadre.plin.toFixed(2)}</strong>
                <small className="cuadre-percentage">
                  {((cuadre.plin / cuadre.total) * 100).toFixed(1)}% del total
                </small>
              </div>
            </div>

            <div className="cuadre-card">
              <div className="cuadre-icon" style={{ background: "rgba(251, 146, 60, 0.1)", color: "#fb923c" }}>
                <CreditCard size={28} />
              </div>
              <div className="cuadre-info">
                <span className="cuadre-label">Tarjeta</span>
                <strong className="cuadre-amount">S/ {cuadre.tarjeta.toFixed(2)}</strong>
                <small className="cuadre-percentage">
                  {((cuadre.tarjeta / cuadre.total) * 100).toFixed(1)}% del total
                </small>
              </div>
            </div>

            <div className="cuadre-card">
              <div className="cuadre-icon" style={{ background: "rgba(234, 179, 8, 0.1)", color: "#ca8a04" }}>
                <DollarSign size={28} />
              </div>
              <div className="cuadre-info">
                <span className="cuadre-label">Transferencia</span>
                <strong className="cuadre-amount">S/ {cuadre.transferencia.toFixed(2)}</strong>
                <small className="cuadre-percentage">
                  {((cuadre.transferencia / cuadre.total) * 100).toFixed(1)}% del total
                </small>
              </div>
            </div>

            <div className="cuadre-card cuadre-total">
              <div className="cuadre-icon" style={{ background: "rgba(201, 168, 118, 0.2)", color: "var(--color-accent)" }}>
                <DollarSign size={32} />
              </div>
              <div className="cuadre-info">
                <span className="cuadre-label">Total Caja</span>
                <strong className="cuadre-amount-large">S/ {cuadre.total.toFixed(2)}</strong>
                <small className="cuadre-percentage">Período seleccionado</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {vistaActiva === "comisiones" && (
        <div className="reportes-content">
          <div className="comisiones-table">
            <table>
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th className="text-center">Servicios</th>
                  <th className="text-right">Total Servicios</th>
                  <th className="text-center">Comisión %</th>
                  <th className="text-right">Comisión S/</th>
                </tr>
              </thead>
              <tbody>
                {comisiones.map((trabajador) => (
                  <tr key={trabajador.id}>
                    <td>
                      <div className="trabajador-info">
                        <div className="trabajador-avatar">
                          {trabajador.nombre.charAt(0).toUpperCase()}
                        </div>
                        <strong>{trabajador.nombre}</strong>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="badge">{trabajador.cantidadServicios}</span>
                    </td>
                    <td className="text-right">S/ {trabajador.totalServicios.toFixed(2)}</td>
                    <td className="text-center">
                      <span className="badge badge-accent">{trabajador.porcentajeComision}%</span>
                    </td>
                    <td className="text-right">
                      <strong className="comision-amount">
                        S/ {trabajador.montoComision.toFixed(2)}
                      </strong>
                    </td>
                  </tr>
                ))}
                {comisiones.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center empty-row">
                      No hay datos de comisiones para este período
                    </td>
                  </tr>
                )}
              </tbody>
              {comisiones.length > 0 && (
                <tfoot>
                  <tr className="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td className="text-center">
                      <strong>{comisiones.reduce((sum, t) => sum + t.cantidadServicios, 0)}</strong>
                    </td>
                    <td className="text-right">
                      <strong>S/ {comisiones.reduce((sum, t) => sum + t.totalServicios, 0).toFixed(2)}</strong>
                    </td>
                    <td className="text-center">-</td>
                    <td className="text-right">
                      <strong className="total-comision">
                        S/ {comisiones.reduce((sum, t) => sum + t.montoComision, 0).toFixed(2)}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
