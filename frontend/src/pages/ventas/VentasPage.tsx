import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Printer, Plus } from "lucide-react";
import { obtenerProductos } from "../productos/productosService";
import type { ProductoConLotes } from "../productos/types";
import { agregarProductoVenta, aplicarPromocionVenta, crearVentaDirecta, obtenerPromociones, obtenerVentasListado, registrarPago } from "./ventasService";
import type { MetodoPago, ProductoVenta, Promocion, VentaCita } from "./types";
import ComprobanteTicketModal from "./ComprobanteTicketModal";
import VentaDirectaModal from "./VentaDirectaModal";
import { useAuth } from "../../context/AuthContext";
import "./ventas.css";

const VENTAS_POR_PAGINA = 50;
const MONTOS_STORAGE_KEY = "ventas_montos_recibidos";

function leerMontosRecibidos(): Record<string, number> {
  try {
    const crudo = sessionStorage.getItem(MONTOS_STORAGE_KEY);
    return crudo ? (JSON.parse(crudo) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function guardarMontoRecibido(ventaId: string, monto: number) {
  const actual = leerMontosRecibidos();
  actual[ventaId] = Math.round(monto * 100) / 100;
  sessionStorage.setItem(MONTOS_STORAGE_KEY, JSON.stringify(actual));
}

export default function VentasPage() {
  const { userId } = useAuth();
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
  const [mostrarTicket, setMostrarTicket] = useState(false);
  const [ticketRecienPagado, setTicketRecienPagado] = useState(false);
  const [mostrarModalVentaDirecta, setMostrarModalVentaDirecta] = useState(false);
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
      const montoFinal = Number(montoRecibido) > 0 ? Number(montoRecibido) : venta.total;
      const actualizada = await registrarPago(venta.id, metodoPago, montoFinal);
      guardarMontoRecibido(venta.id, montoFinal);
      setVenta(actualizada);
      setVentas((actuales) => actuales.map((item) => item.id === actualizada.id ? actualizada : item));
      setError(null);
      setTicketRecienPagado(true);
      setMostrarTicket(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    } finally {
      setOcupado(false);
    }
  }

  async function handleCrearVentaDirecta(clienteId: string) {
    if (!userId) {
      setError("No se pudo obtener el usuario actual");
      return;
    }

    try {
      setOcupado(true);
      const nuevaVenta = await crearVentaDirecta(clienteId, userId);
      setVentas((actuales) => [nuevaVenta, ...actuales]);
      setVenta(nuevaVenta);
      setMontoRecibido(nuevaVenta.total);
      setTicketRecienPagado(false);
      setError(null);
      setMostrarModalVentaDirecta(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la venta directa.");
      throw err;
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

  const cambio = Math.max(Number(montoRecibido || 0) - (venta?.total ?? 0), 0);

  return (
    <div className="ventas-page">
      <div className="ventas-page-header">
        <div>
          <h2>Ventas y Cobros</h2>
          <p className="page-subtitle">Gestiona las ventas y registra los pagos</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setMostrarModalVentaDirecta(true)}
        >
          <Plus size={18} />
          Nueva venta directa
        </button>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {/* Tabs de navegación */}
      <div className="ventas-tabs">
        <button
          className={`ventas-tab ${!venta || venta.estado === "Pendiente" ? "active" : ""}`}
          onClick={() => {
            const primera = pendientes[0];
            if (primera) {
              setVenta(primera);
              setMontoRecibido(primera.total);
              setTicketRecienPagado(false);
              setError(null);
            }
          }}
        >
          <span className="tab-label">Pendientes</span>
          <span className="tab-badge">{pendientes.length}</span>
        </button>
        <button 
          className={`ventas-tab ${venta && venta.estado === "Pagado" ? "active" : ""}`}
          onClick={() => {
            const primera = pagadas[0];
            if (primera) {
              setVenta(primera);
              setMontoRecibido(leerMontosRecibidos()[primera.id] ?? primera.total);
              setTicketRecienPagado(false);
              setError(null);
            }
          }}
        >
          <span className="tab-label">Pagadas</span>
          <span className="tab-badge">{pagadas.length}</span>
        </button>
      </div>

      {/* Lista horizontal de ventas */}
      <div className="ventas-carousel">
        {(!venta || venta.estado === "Pendiente" ? pendientes : pagadas).length === 0 ? (
          <div className="empty-state-inline">
            {!venta || venta.estado === "Pendiente"
              ? "No hay ventas pendientes"
              : "No hay ventas pagadas"}
          </div>
        ) : (
          <div className="ventas-scroll">
            {(!venta || venta.estado === "Pendiente" ? pendientes : pagadas).map((item) => (
              <button
                key={item.id}
                className={`venta-card ${venta?.id === item.id ? "selected" : ""}`}
                onClick={() => {
                  setVenta(item);
                  setMontoRecibido(item.estado === "Pagado"
                    ? (leerMontosRecibidos()[item.id] ?? item.total)
                    : item.total);
                  setTicketRecienPagado(false);
                  setError(null);
                }}
              >
                <div className="venta-card-header">
                  <span className="venta-card-cliente">{item.clienteNombre || "Cliente"}</span>
                  <span className="venta-card-total">S/ {item.total.toFixed(2)}</span>
                </div>
                <div className="venta-card-meta">
                  <span>{item.citaId ? `Cita #${item.citaId}` : `Venta #${item.id}`}</span>
                  {item.metodoPago && <span className="venta-card-metodo">· {item.metodoPago}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {hayMasVentas && (
        <button
          className="btn btn-secondary load-more-btn"
          type="button"
          onClick={() => void cargarMasVentas()}
          disabled={cargandoMas}
        >
          {cargandoMas ? "Cargando..." : "Cargar más ventas"}
        </button>
      )}
      {!venta ? <div className="empty-state">
        <div className="empty-icon">🛍️</div>
        <strong>Selecciona una venta</strong>
        <p>Elige una venta pendiente para gestionar el pago</p>
      </div> : <>

      <div className="venta-detail-layout">
        {/* Panel izquierdo - Detalle */}
        <div className="venta-detail-panel">
          <div className="venta-info-header">
            <div>
              <h3 className="venta-cliente-nombre">{venta.clienteNombre}</h3>
              <div className="venta-meta-info">
                <span>{venta.citaId ? `Cita #${venta.citaId}` : `Venta #${venta.id}`}</span>
                {venta.clienteTelefono && <span>· {venta.clienteTelefono}</span>}
                {venta.clienteDni && <span>· DNI: {venta.clienteDni}</span>}
              </div>
            </div>
            <span className={`status-badge ${venta.pagada ? "paid" : "pending"}`}>
              {venta.pagada ? "✓ Pagada" : "Pendiente"}
            </span>
          </div>

          {/* Servicios */}
          <div className="venta-section">
            <h4 className="section-title">
              <span>Servicios contratados</span>
              <span className="section-count">{venta.servicios.length}</span>
            </h4>
            <div className="items-list">
              {venta.servicios.length === 0 ? (
                <div className="empty-mini">Sin servicios</div>
              ) : (
                venta.servicios.map((servicio) => (
                  <div className="item-row" key={servicio.id}>
                    <div className="item-info">
                      <span className="item-icon">✂️</span>
                      <div>
                        <strong className="item-name">{servicio.nombre}</strong>
                        <small className="item-meta">{servicio.duracion} minutos</small>
                        {Boolean(servicio.descuentoPorcentaje) && (
                          <small className="item-discount">
                            🏷️ Descuento {servicio.descuentoPorcentaje}% aplicado
                          </small>
                        )}
                      </div>
                    </div>
                    <span className="item-price">S/ {servicio.precio.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Productos */}
          <div className="venta-section">
            <h4 className="section-title">
              <span>Productos adicionales</span>
              <span className="section-count">{venta.productos.length}</span>
            </h4>

            {!venta.pagada && (
              <form className="add-producto-form" onSubmit={handleAgregarProducto}>
                <select
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                  disabled={ocupado}
                >
                  <option value="">Seleccionar producto...</option>
                  {productosCatalogo.filter((p) => p.stock_total > 0).map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre} · Stock: {producto.stock_total}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  max={productosCatalogo.find((item) => item.id === productoId)?.stock_total ?? 1}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value || 1))}
                  placeholder="Cant."
                  disabled={ocupado}
                />

                <button
                  className="btn btn-secondary"
                  type="submit"
                  disabled={!productoId || ocupado}
                >
                  <Plus size={16} />
                  Añadir
                </button>
              </form>
            )}

            <div className="items-list">
              {venta.productos.length === 0 ? (
                <div className="empty-mini">Sin productos adicionales</div>
              ) : (
                venta.productos.map((producto: ProductoVenta) => (
                  <div className="item-row" key={producto.id}>
                    <div className="item-info">
                      <span className="item-icon">📦</span>
                      <div>
                        <strong className="item-name">{producto.nombre}</strong>
                        <small className="item-meta">Cantidad: {producto.cantidad}</small>
                      </div>
                    </div>
                    <span className="item-price">
                      S/ {(producto.precioUnitario * producto.cantidad).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Panel derecho - Resumen y Pago */}
        <div className="venta-summary-panel">
          <h4 className="summary-title">Resumen de pago</h4>

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
              <select
                value={metodoPago}
                onChange={(e) => {
                  const m = e.target.value as MetodoPago;
                  setMetodoPago(m);
                  if (m !== "efectivo") {
                    setMontoRecibido(venta.total);
                  }
                }}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
              </select>
            </label>

            <label>
              Importe recibido
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="number"
                  min={venta.total}
                  step="0.01"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(Number(e.target.value || 0))}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                  onClick={() => setMontoRecibido(venta.total)}
                >
                  Exacto
                </button>
              </div>
            </label>

            <div className="summary-row">
              <span>Cambio</span>
              <strong>S/ {cambio.toFixed(2)}</strong>
            </div>
          </div>}

          {!venta.pagada && (
            <button className="btn btn-primary full" onClick={() => void handleRegistrarPago()} disabled={ocupado}>
              {ocupado ? "Procesando..." : "Registrar pago"}
            </button>
          )}

          {venta.pagada && (
            <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ padding: "0.6rem 1rem", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "8px", color: "#16a34a", fontSize: "0.9rem", fontWeight: 600, textAlign: "center" }}>
                ✓ Cuenta Pagada ({venta.metodoPago ? venta.metodoPago.toUpperCase() : "REGISTRADO"})
              </div>
              <button
                type="button"
                className="btn btn-primary full"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                onClick={() => {
                  setMontoRecibido(leerMontosRecibidos()[venta.id] ?? venta.total);
                  setTicketRecienPagado(false);
                  setMostrarTicket(true);
                }}
              >
                <Printer style={{ width: 18, height: 18 }} />
                Ver / Imprimir Ticket
              </button>
            </div>
          )}
        </div>
      </div>
      </>}

      {/* Modal del Comprobante / Ticket Térmico */}
      {mostrarTicket && venta && (
        <ComprobanteTicketModal
          venta={venta}
          montoRecibido={montoRecibido}
          recienPagada={ticketRecienPagado}
          onClose={() => {
            setMostrarTicket(false);
            setTicketRecienPagado(false);
          }}
        />
      )}

      {/* Modal de Venta Directa */}
      {mostrarModalVentaDirecta && (
        <VentaDirectaModal
          onCrear={handleCrearVentaDirecta}
          onCerrar={() => setMostrarModalVentaDirecta(false)}
        />
      )}
    </div>
  );
}
