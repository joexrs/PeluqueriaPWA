import { useEffect, useMemo, useState, type FormEvent } from "react";
import { obtenerProductos } from "../productos/productosService";
import type { ProductoConLotes } from "../productos/types";
import { agregarProductoVenta, obtenerVentasDeCitas, registrarPago } from "./ventasService";
import type { MetodoPago, ProductoVenta, VentaCita } from "./types";
import "./ventas.css";

export default function VentasPage() {
  const [venta, setVenta] = useState<VentaCita | null>(null);
  const [ventas, setVentas] = useState<VentaCita[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<ProductoConLotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      try {
        setLoading(true);
        const [ventasData, productosData] = await Promise.all([
          obtenerVentasDeCitas(),
          obtenerProductos({ soloActivos: true }),
        ]);

        if (cancelled) return;
        const pendientes = ventasData.filter((item) => !item.pagada);
        const citaSolicitada = new URLSearchParams(window.location.search).get("cita_id");
        const inicial = pendientes.find((item) => item.citaId === citaSolicitada) ?? pendientes[0] ?? null;
        setVentas(pendientes);
        setVenta(inicial);
        setProductosCatalogo(productosData);
        setProductoId((actual) => actual || productosData.find((p) => p.stock_total > 0)?.id || "");
        setMontoRecibido(inicial?.total ?? 0);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la venta.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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

    if (!venta || !productoId) return;

    try {
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        setError("La cantidad debe ser un entero mayor que cero.");
        return;
      }
      setOcupado(true);
      const actualizada = await agregarProductoVenta(venta.citaId, productoId, cantidad);
      setVenta(actualizada);
      setVentas((actuales) => actuales.map((item) => item.citaId === actualizada.citaId ? actualizada : item));
      setError(null);
      setCantidad(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir el producto.");
    } finally {
      setOcupado(false);
    }
  }

  async function handleRegistrarPago() {
    if (!venta) return;

    try {
      setOcupado(true);
      const actualizada = await registrarPago(venta.citaId, metodoPago, Number(montoRecibido));
      setVenta(actualizada);
      setVentas((actuales) => actuales.filter((item) => item.citaId !== actualizada.citaId));
      setVenta(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    } finally {
      setOcupado(false);
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

  if (!venta && ventas.length === 0) {
    return (
      <div className="ventas-page">
        {error && <div className="banner-error">{error}</div>}
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <strong>No hay ventas pendientes asociadas a citas.</strong>
          <p>Registra una venta desde el detalle de una cita para que aparezca aquí.</p>
          <a className="btn btn-primary" href="/citas">Ir a citas</a>
        </div>
      </div>
    );
  }

  const cambio = Math.max(Number(montoRecibido || 0) - (venta?.total ?? 0), 0);

  return (
    <div className="ventas-page">
      <label className="venta-selector">
        Venta pendiente
        <select
          value={venta?.citaId ?? ""}
          onChange={(event) => {
            const seleccionada = ventas.find((item) => item.citaId === event.target.value) ?? null;
            setVenta(seleccionada);
            setMontoRecibido(seleccionada?.total ?? 0);
            setError(null);
          }}
        >
          {ventas.map((item) => (
            <option key={item.id} value={item.citaId}>
              {item.clienteNombre || "Cliente"} · Cita {item.citaId} · S/ {item.total.toFixed(2)}
            </option>
          ))}
        </select>
      </label>
      {!venta ? <div className="empty-state">Selecciona una venta pendiente.</div> : <>
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
                <span>S/ {servicio.precio.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <h3>Productos adicionales</h3>
          <form className="producto-form" onSubmit={handleAgregarProducto}>
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
              <option value="">Selecciona producto</option>
              {productosCatalogo.filter((producto) => producto.stock_total > 0).map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre} (stock: {producto.stock_total})
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              max={productosCatalogo.find((item) => item.id === productoId)?.stock_total ?? 1}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value || 1))}
            />

            <button className="btn btn-primary" type="submit" disabled={!productoId || ocupado}>
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
                  <span>S/ {(producto.precioUnitario * producto.cantidad).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel summary-panel">
          <h3>Resumen</h3>

          <div className="summary-row">
            <span>Servicios</span>
            <strong>S/ {totalServicios.toFixed(2)}</strong>
          </div>
          <div className="summary-row">
            <span>Productos</span>
            <strong>S/ {totalProductos.toFixed(2)}</strong>
          </div>
          <div className="summary-row total-row">
            <span>Total</span>
            <strong>S/ {venta.total.toFixed(2)}</strong>
          </div>

          <div className="payment-box">
            <label>
              Método de pago
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
              </select>
            </label>

            <label>
              Importe recibido
              <input
                type="number"
                min={venta.total}
                step="0.01"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(Number(e.target.value || 0))}
              />
            </label>

            <div className="summary-row">
              <span>Cambio</span>
              <strong>S/ {cambio.toFixed(2)}</strong>
            </div>
          </div>

          <button className="btn btn-primary full" onClick={() => void handleRegistrarPago()} disabled={ocupado || venta.pagada}>
            {ocupado ? "Procesando..." : "Registrar pago"}
          </button>
        </div>
      </div>
      </>}
    </div>
  );
}
