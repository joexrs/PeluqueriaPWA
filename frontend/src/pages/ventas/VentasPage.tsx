import { useEffect, useMemo, useState, type FormEvent } from "react";
import { agregarProductoVenta, obtenerVentaPorCita, registrarPago } from "./ventasService";
import type { MetodoPago, ProductoVenta, VentaCita } from "./types";
import "./ventas.css";

const CITA_ID = "cita-101";

export default function VentasPage() {
  const [venta, setVenta] = useState<VentaCita | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productoId, setProductoId] = useState("p1");
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
  const [montoRecibido, setMontoRecibido] = useState(0);

  useEffect(() => {
    void cargarVenta();
  }, []);

  async function cargarVenta() {
    try {
      setLoading(true);
      const data = await obtenerVentaPorCita(CITA_ID);
      setVenta(data);
      setMontoRecibido(data?.total ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la venta.");
    } finally {
      setLoading(false);
    }
  }

  const totalServicios = useMemo(
    () => venta?.servicios.reduce((sum, servicio) => sum + servicio.precio, 0) ?? 0,
    [venta],
  );

  const totalProductos = useMemo(
    () => venta?.productos.reduce((sum, producto) => sum + producto.precioUnitario * producto.cantidad, 0) ?? 0,
    [venta],
  );

  async function handleAgregarProducto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const actualizada = await agregarProductoVenta(CITA_ID, productoId, cantidad);
      setVenta(actualizada);
      setError(null);
      setCantidad(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir el producto.");
    }
  }

  async function handleRegistrarPago() {
    if (!venta) return;

    try {
      const actualizada = await registrarPago(CITA_ID, metodoPago, Number(montoRecibido || venta.total));
      setVenta(actualizada);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏳</div>
        <strong>Cargando venta...</strong>
      </div>
    );
  }

  if (!venta) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🧾</div>
        <strong>No hay una venta activa para esta cita.</strong>
      </div>
    );
  }

  const cambio = Math.max(Number(montoRecibido || 0) - venta.total, 0);

  return (
    <div className="ventas-page">
      <div className="ventas-header">
        <div>
          <p className="eyebrow">Cerrar cita</p>
          <h2>{venta.clienteNombre}</h2>
        </div>
        <span className={`status ${venta.pagada ? "paid" : "pending"}`}>
          {venta.pagada ? "Pagada" : "Pendiente"}
        </span>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="ventas-layout">
        <div className="panel">
          <h3>Servicios contratados</h3>
          <div className="list-block">
            {venta.servicios.map((servicio) => (
              <div className="row-item" key={servicio.id}>
                <div>
                  <strong>{servicio.nombre}</strong>
                  <small>{servicio.duracion} min</small>
                </div>
                <span>€{servicio.precio}</span>
              </div>
            ))}
          </div>

          <h3>Productos adicionales</h3>
          <form className="producto-form" onSubmit={handleAgregarProducto}>
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
              <option value="p1">Tinte rubio ceniza</option>
              <option value="p2">Shampoo hidratante</option>
              <option value="p3">Cera moldeadora</option>
              <option value="p4">Esmalte rojo clásico</option>
            </select>

            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value || 1))}
            />

            <button className="btn btn-primary" type="submit">
              + Añadir
            </button>
          </form>

          <div className="list-block">
            {venta.productos.length === 0 ? (
              <div className="empty-mini">Sin productos adicionales</div>
            ) : (
              venta.productos.map((producto: ProductoVenta) => (
                <div className="row-item" key={producto.id}>
                  <div>
                    <strong>{producto.nombre}</strong>
                    <small>{producto.cantidad} ud.</small>
                  </div>
                  <span>€{producto.precioUnitario * producto.cantidad}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel summary-panel">
          <h3>Resumen</h3>

          <div className="summary-row">
            <span>Servicios</span>
            <strong>€{totalServicios}</strong>
          </div>
          <div className="summary-row">
            <span>Productos</span>
            <strong>€{totalProductos}</strong>
          </div>
          <div className="summary-row total-row">
            <span>Total</span>
            <strong>€{venta.total}</strong>
          </div>

          <div className="payment-box">
            <label>
              Método de pago
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </label>

            <label>
              Importe recibido
              <input
                type="number"
                min="0"
                step="0.01"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(Number(e.target.value || 0))}
              />
            </label>

            <div className="summary-row">
              <span>Cambio</span>
              <strong>€{cambio}</strong>
            </div>
          </div>

          <button className="btn btn-primary full" onClick={() => void handleRegistrarPago()} disabled={venta.pagada}>
            {venta.pagada ? "Venta pagada" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
