import { useEffect, useMemo, useState, type FormEvent } from "react";
import { obtenerProductos } from "../productos/productosService";
import type { ProductoConLotes } from "../productos/types";
import { agregarProductoVenta, aplicarPromocionVenta, obtenerPromociones, obtenerVentasListado, registrarPago } from "./ventasService";
import type { MetodoPago, ProductoVenta, Promocion, VentaCita } from "./types";
import "./ventas.css";

const VENTAS_POR_PAGINA = 50;

export default function VentasPage() {
  const [venta, setVenta] = useState<VentaCita | null>(null);
  const [ventas, setVentas] = useState<VentaCita[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<ProductoConLotes[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [promocionId, setPromocionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMasVentas, setHayMasVentas] = useState(true);
  const pendientes = useMemo(() => ventas.filter((item) => item.estado === "Pendiente"), [ventas]);
  const pagadas = useMemo(() => ventas.filter((item) => item.estado === "Pagado"), [ventas]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      try {
        setLoading(true);
        const [ventasData, productosData, promocionesData] = await Promise.all([
          obtenerVentasListado(0, VENTAS_POR_PAGINA),
          obtenerProductos({ soloActivos: true }),
          obtenerPromociones(),
        ]);

        if (cancelled) return;
        const citaSolicitada = new URLSearchParams(window.location.search).get("cita_id");
        const pendientesIniciales = ventasData.filter((item) => item.estado === "Pendiente");
        const inicial = pendientesIniciales.find((item) => item.citaId === citaSolicitada) ?? pendientesIniciales[0] ?? null;
        setVentas(ventasData);
        setHayMasVentas(ventasData.length === VENTAS_POR_PAGINA);
        setVenta(inicial);
        setProductosCatalogo(productosData);
        setPromociones(promocionesData);
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

  async function cargarMasVentas() {
    try {
      setCargandoMas(true);
      const siguientes = await obtenerVentasListado(ventas.length, VENTAS_POR_PAGINA);
      setVentas((actuales) => [...actuales, ...siguientes]);
      setHayMasVentas(siguientes.length === VENTAS_POR_PAGINA);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar más ventas.");
    } finally {
      setCargandoMas(false);
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

  const promocionesElegibles = useMemo(() => promociones.filter((promo) =>
    !promo.Servicio_ID || venta?.servicios.some((servicio) => servicio.id === String(promo.Servicio_ID)),
  ), [promociones, venta]);

  async function handleAplicarPromocion() {
    if (!venta || !promocionId) return;
    try {
      setOcupado(true);
      const actualizada = await aplicarPromocionVenta(venta.id, promocionId);
      setVenta(actualizada);
      setVentas((actuales) => actuales.map((item) => item.id === actualizada.id ? actualizada : item));
      setMontoRecibido(actualizada.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar la promoción.");
    } finally {
      setOcupado(false);
    }
  }

  async function handleAgregarProducto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!venta || !productoId) return;

    try {
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        setError("La cantidad debe ser un entero mayor que cero.");
        return;
      }
      setOcupado(true);
      const actualizada = await agregarProductoVenta(venta.id, productoId, cantidad);
      setVenta(actualizada);
      setVentas((actuales) => actuales.map((item) => item.id === actualizada.id ? actualizada : item));
      setMontoRecibido(actualizada.total);
      setProductosCatalogo((actuales) => actuales.map((item) => item.id === productoId
        ? { ...item, stock_total: Math.max(0, item.stock_total - cantidad) }
        : item));
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
      const actualizada = await registrarPago(venta.id, metodoPago, Number(montoRecibido));
      setVenta(actualizada);
      setVentas((actuales) => actuales.map((item) => item.id === actualizada.id ? actualizada : item));
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
        <div className="empty-icon">â³</div>
        <strong>Cargando venta...</strong>
      </div>
    );
  }

  const cambio = Math.max(Number(montoRecibido || 0) - (venta?.total ?? 0), 0);

  return (
    <div className="ventas-page">
      {error && <div className="banner-error">{error}</div>}
      <section className="ventas-listados">
        <div className="panel">
          <h3>Pendientes de pago <span className="ventas-count">{pendientes.length}</span></h3>
          {pendientes.length === 0 ? <p className="empty-mini">No hay cuentas pendientes.</p> : <div className="ventas-lista">
            {pendientes.map((item) => <button className={`venta-lista-item ${venta?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setVenta(item); setMontoRecibido(item.total); setError(null); }}>
              <span><strong>{item.clienteNombre || "Cliente"}</strong><small>{item.citaId ? `Cita ${item.citaId}` : `Venta #${item.id}`}</small></span><strong>S/ {item.total.toFixed(2)}</strong>
            </button>)}
          </div>}
        </div>
        <div className="panel">
          <h3>Pagadas <span className="ventas-count">{pagadas.length}</span></h3>
          {pagadas.length === 0 ? <p className="empty-mini">Aun no hay ventas pagadas.</p> : <div className="ventas-lista">
            {pagadas.map((item) => <button className={`venta-lista-item ${venta?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setVenta(item); setError(null); }}>
              <span><strong>{item.clienteNombre || "Cliente"}</strong><small>{item.citaId ? `Cita ${item.citaId}` : `Venta #${item.id}`} · {item.metodoPago ?? "Pago registrado"}</small></span><strong>S/ {item.total.toFixed(2)}</strong>
            </button>)}
          </div>}
        </div>
      </section>
      {hayMasVentas && <button className="btn btn-secondary" type="button" onClick={() => void cargarMasVentas()} disabled={cargandoMas}>
        {cargandoMas ? "Cargando..." : "Cargar más ventas"}
      </button>}
      {!venta ? <div className="empty-state">Selecciona una venta pendiente.</div> : <>
      <div className="ventas-header">
        <div>
          <p className="eyebrow">{venta.pagada ? "Venta pagada" : "Cerrar cita"}</p>
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
                  {Boolean(servicio.descuentoPorcentaje) && <small className="discount-label">Promoción aplicada: {servicio.descuentoPorcentaje}%</small>}
                </div>
                <span>S/ {servicio.precio.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <h3>Productos adicionales</h3>
          {!venta.pagada && <form className="producto-form" onSubmit={handleAgregarProducto}>
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
          </form>}

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

          {!venta.pagada && <div className="promotion-box">
            <label>
              Promoción
              <select value={promocionId} onChange={(event) => setPromocionId(event.target.value)}>
                <option value="">Selecciona una promoción</option>
                {promocionesElegibles.map((promo) => <option key={String(promo.ID)} value={String(promo.ID)}>
                  {promo.Nombre} ({Number(promo.Porcentaje_Descuento)}%{promo.Servicio_ID ? " en servicio específico" : " en servicios"})
                </option>)}
              </select>
            </label>
            <button className="btn btn-secondary" type="button" onClick={() => void handleAplicarPromocion()} disabled={!promocionId || ocupado || promocionesElegibles.length === 0}>
              Aplicar promoción
            </button>
            {promocionesElegibles.length === 0 && <small>No hay promociones vigentes aplicables a los servicios de esta venta.</small>}
          </div>}

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

          {!venta.pagada && <div className="payment-box">
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
          </div>}

          {!venta.pagada && <button className="btn btn-primary full" onClick={() => void handleRegistrarPago()} disabled={ocupado}>
            {ocupado ? "Procesando..." : "Registrar pago"}
          </button>}
        </div>
      </div>
      </>}
    </div>
  );
}
