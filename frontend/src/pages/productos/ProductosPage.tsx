import { useMemo, useState } from "react";
import { PRODUCTOS_INICIALES, MOVIMIENTOS_INICIALES } from "./mockData";
import type { Producto, Movimiento, TipoMovimiento } from "./types";
import MovimientoForm from "./MovimientoForm";
import "./productos.css";

type Vista = "lista" | "detalle" | "form" | "confirmacion";

interface UltimoMovimiento {
  productoNombre: string;
  tipo: TipoMovimiento;
  cantidad: number;
  stockNuevo: number;
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_INICIALES);
  const [movimientos, setMovimientos] = useState<Movimiento[]>(MOVIMIENTOS_INICIALES);
  const [vista, setVista] = useState<Vista>("lista");
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [ultimoMovimiento, setUltimoMovimiento] = useState<UltimoMovimiento | null>(null);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q) || p.tipo.toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

  const productoDetalle = productos.find((p) => p.id === productoSeleccionadoId) ?? null;
  const historialDetalle = movimientos
    .filter((m) => m.productoId === productoSeleccionadoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  function abrirDetalle(id: string) {
    setProductoSeleccionadoId(id);
    setVista("detalle");
  }

  function abrirFormulario(id?: string) {
    setProductoSeleccionadoId(id ?? productos[0]?.id ?? null);
    setVista("form");
  }

  function handleGuardarMovimiento(data: { productoId: string; tipo: TipoMovimiento; cantidad: number; caducidad?: string }) {
    const producto = productos.find((p) => p.id === data.productoId);
    if (!producto) return "Selecciona un producto válido.";

    if (data.tipo === "salida" && data.cantidad > producto.stock) {
      return `No se puede registrar: la salida (${data.cantidad}) supera el stock disponible (${producto.stock}).`;
    }

    const stockNuevo = data.tipo === "entrada" ? producto.stock + data.cantidad : producto.stock - data.cantidad;

    setProductos((prev) =>
      prev.map((p) =>
        p.id === producto.id
          ? { ...p, stock: stockNuevo, caducidad: data.tipo === "entrada" && data.caducidad ? data.caducidad : p.caducidad }
          : p
      )
    );
    setMovimientos((prev) => [
      { id: `mov-${Date.now()}`, productoId: producto.id, tipo: data.tipo, cantidad: data.cantidad, fecha: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
    setUltimoMovimiento({ productoNombre: producto.nombre, tipo: data.tipo, cantidad: data.cantidad, stockNuevo });
    setVista("confirmacion");
    return null;
  }

  // ---------- Vista: Lista ----------
  if (vista === "lista") {
    return (
      <div className="productos-page">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            disabled={productos.length === 0}
          />
          <button className="btn btn-primary" onClick={() => abrirFormulario()}>
            + Registrar movimiento
          </button>
        </div>

        {productos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <strong>Todavía no hay productos registrados</strong>
          </div>
        ) : (
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Marca</th>
                <th>Tipo</th>
                <th>Stock</th>
                <th>Caducidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p) => {
                const bajo = p.stock <= p.stockMin;
                return (
                  <tr key={p.id} className="fila-clickable" onClick={() => abrirDetalle(p.id)}>
                    <td data-label="Producto">{p.nombre}</td>
                    <td data-label="Marca">{p.marca}</td>
                    <td data-label="Tipo">{p.tipo}</td>
                    <td data-label="Stock">{p.stock}</td>
                    <td data-label="Caducidad">{p.caducidad ?? "—"}</td>
                    <td data-label="Estado">
                      <span className={`tag ${bajo ? "tag-bajo" : "tag-ok"}`}>{bajo ? "Stock bajo" : "OK"}</span>
                    </td>
                  </tr>
                );
              })}
              {productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="sin-resultados">
                    Ningún producto coincide con "{busqueda}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // ---------- Vista: Detalle ----------
  if (vista === "detalle" && productoDetalle) {
    return (
      <div className="productos-page">
        <span className="back-link" onClick={() => setVista("lista")}>
          ← Volver al inventario
        </span>
        <h2 className="detalle-titulo">{productoDetalle.nombre}</h2>
        <p className="sub">
          {productoDetalle.marca} · {productoDetalle.tipo}
          {productoDetalle.proveedor ? ` · ${productoDetalle.proveedor}` : ""}
        </p>

        <div className="detalle-grid">
          <div>
            <div className="info-row">
              <span>Stock actual</span>
              <span>{productoDetalle.stock}</span>
            </div>
            <div className="info-row">
              <span>Stock mínimo</span>
              <span>{productoDetalle.stockMin}</span>
            </div>
            <div className="info-row">
              <span>Caducidad</span>
              <span>{productoDetalle.caducidad ?? "—"}</span>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => abrirFormulario(productoDetalle.id)}>
              + Registrar movimiento
            </button>
          </div>
          <div>
            <table className="tabla-productos">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {historialDetalle.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="sin-resultados">
                      Sin movimientos registrados todavía.
                    </td>
                  </tr>
                ) : (
                  historialDetalle.map((m) => (
                    <tr key={m.id}>
                      <td>{m.fecha}</td>
                      <td>{m.tipo === "entrada" ? "Entrada" : "Salida"}</td>
                      <td>{m.cantidad}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Vista: Formulario ----------
  if (vista === "form") {
    return (
      <div className="productos-page">
        <span className="back-link" onClick={() => setVista(productoSeleccionadoId ? "detalle" : "lista")}>
          ← Cancelar
        </span>
        <MovimientoForm
          productos={productos}
          productoIdInicial={productoSeleccionadoId ?? productos[0]?.id ?? ""}
          onSubmit={handleGuardarMovimiento}
          onCancel={() => setVista(productoSeleccionadoId ? "detalle" : "lista")}
        />
      </div>
    );
  }

  // ---------- Vista: Confirmación ----------
  if (vista === "confirmacion" && ultimoMovimiento) {
    return (
      <div className="productos-page">
        <div className="confirm-wrap">
          <div className="confirm-icon">✓</div>
          <h2>Movimiento registrado</h2>
          <p className="sub">El stock se actualizó correctamente.</p>
          <div className="confirm-summary">
            <div className="info-row">
              <span>Producto</span>
              <span>{ultimoMovimiento.productoNombre}</span>
            </div>
            <div className="info-row">
              <span>Tipo</span>
              <span>{ultimoMovimiento.tipo === "entrada" ? "Entrada" : "Salida"}</span>
            </div>
            <div className="info-row">
              <span>Cantidad</span>
              <span>{ultimoMovimiento.cantidad}</span>
            </div>
            <div className="info-row">
              <span>Stock nuevo</span>
              <span>{ultimoMovimiento.stockNuevo}</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setVista("lista")}>
            Volver al inventario
          </button>
        </div>
      </div>
    );
  }

  return null;
}
