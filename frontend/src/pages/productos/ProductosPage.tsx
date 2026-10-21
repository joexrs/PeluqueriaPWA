import { useEffect, useMemo, useState } from "react";
import {
  crearProducto,
  obtenerCategoriasProductos,
  obtenerProductos,
  registrarEntrada,
  registrarSalida,
  type CategoriaProductoRow,
} from "./productosService";
import type { CrearProductoPayload, ProductoConLotes, RegistrarEntradaPayload, RegistrarSalidaPayload } from "./types";
import ProductoForm from "./ProductoForm";
import MovimientoForm from "./MovimientoForm";
import "./productos.css";

type Vista = "lista" | "detalle" | "crear" | "movimiento";

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AvisosInventario({ productos, aviso }: { productos: ProductoConLotes[]; aviso: string | null }) {
  const hoy = fechaLocalISO(new Date());
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + 30);
  const hasta = fechaLocalISO(fechaLimite);
  const vencidos = productos.flatMap((producto) => producto.lotes
    .filter((lote) => Number(lote.Cantidad) > 0 && lote.Fecha_vencimiento < hoy)
    .map((lote) => ({ producto: producto.nombre, fecha: lote.Fecha_vencimiento, cantidad: Number(lote.Cantidad) })));
  const porVencer = productos.flatMap((producto) => producto.lotes
    .filter((lote) => Number(lote.Cantidad) > 0 && lote.Fecha_vencimiento >= hoy && lote.Fecha_vencimiento <= hasta)
    .map((lote) => ({ producto: producto.nombre, fecha: lote.Fecha_vencimiento, cantidad: Number(lote.Cantidad) })));
  const sinStock = productos.filter((producto) => producto.stock_total <= 0);

  return (
    <section className="inventario-notificaciones" aria-label="Avisos de inventario">
      {aviso && <div className="inventario-aviso inventario-aviso--success" role="status">{aviso}</div>}
      {vencidos.length > 0 && <div className="inventario-aviso inventario-aviso--danger" role="status">
        <strong>{vencidos.length} lote(s) vencido(s) con existencias.</strong>
        <span>{vencidos.slice(0, 3).map((item) => `${item.producto} (${item.cantidad})`).join(" · ")}</span>
      </div>}
      {porVencer.length > 0 && <div className="inventario-aviso inventario-aviso--warning" role="status">
        <strong>{porVencer.length} lote(s) vencen en los próximos 30 días.</strong>
        <span>{porVencer.slice(0, 3).map((item) => `${item.producto}: ${item.fecha}`).join(" · ")}</span>
      </div>}
      {sinStock.length > 0 && <div className="inventario-aviso inventario-aviso--warning" role="status">
        <strong>{sinStock.length} producto(s) sin existencias.</strong>
        <span>{sinStock.slice(0, 4).map((producto) => producto.nombre).join(" · ")}</span>
      </div>}
    </section>
  );
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<ProductoConLotes[]>([]);
  const [categorias, setCategorias] = useState<CategoriaProductoRow[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function cargarDatos() {
      try {
        setLoading(true);
        const [productosData, categoriasData] = await Promise.all([
          obtenerProductos(),
          obtenerCategoriasProductos(),
        ]);

        if (!cancelled) {
          setProductos(productosData);
          setCategorias(categoriasData);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los productos.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void cargarDatos();

    return () => {
      cancelled = true;
    };
  }, []);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;

    return productos.filter((producto) => {
      const texto = `${producto.nombre} ${producto.marca} ${producto.categoria?.nombre ?? ""} ${producto.codigo_barras ?? ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [productos, busqueda]);

  const productoDetalle = productos.find((producto) => producto.id === productoSeleccionadoId) ?? null;

  async function recargarProductos() {
    const data = await obtenerProductos();
    setProductos(data);
  }

  async function handleCrearProducto(payload: CrearProductoPayload) {
    const creado = await crearProducto(payload);
    setProductos((prev) => [creado, ...prev]);
    setProductoSeleccionadoId(creado.id);
    setVista("detalle");
  }

  async function handleMovimientoSubmit(data: RegistrarEntradaPayload | RegistrarSalidaPayload) {
    const esEntrada = "fecha_caducidad" in data;
    if (esEntrada) {
      await registrarEntrada({
        producto_id: data.producto_id,
        cantidad: data.cantidad,
        fecha_caducidad: data.fecha_caducidad,
      });
    } else {
      await registrarSalida({
        producto_id: data.producto_id,
        cantidad: data.cantidad,
      });
    }

    await recargarProductos();
    setAviso(esEntrada
      ? "Entrada registrada: se creó un lote y se actualizó el stock."
      : "Salida registrada: se descontaron primero los lotes con vencimiento más próximo.");
    setError(null);
    setVista("detalle");
  }

  function abrirDetalle(id: string) {
    setProductoSeleccionadoId(id);
    setVista("detalle");
  }

  function abrirFormularioMovimiento(id?: string) {
    setProductoSeleccionadoId(id ?? productoSeleccionadoId ?? productos[0]?.id ?? null);
    setVista("movimiento");
  }

  if (loading) {
    return (
      <div className="productos-page">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <strong>Cargando inventario...</strong>
        </div>
      </div>
    );
  }

  if (vista === "lista") {
    return (
      <div className="productos-page">
        <div className="toolbar">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            disabled={productos.length === 0}
          />
          <button className="btn btn-primary" onClick={() => setVista("crear")}>
            + Nuevo producto
          </button>
        </div>

        <AvisosInventario productos={productos} aviso={aviso} />

        {error && <div className="banner-error">{error}</div>}

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
                <th>Categoría</th>
                <th>Stock</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sin-resultados">
                    Ningún producto coincide con "{busqueda}".
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((producto) => {
                  const sinExistencias = producto.stock_total <= 0;
                  return (
                    <tr key={producto.id} className="fila-clickable" onClick={() => abrirDetalle(producto.id)}>
                      <td data-label="Producto">{producto.nombre}</td>
                      <td data-label="Marca">{producto.marca}</td>
                      <td data-label="Categoría">{producto.categoria?.nombre ?? "Sin categoría"}</td>
                      <td data-label="Stock">{producto.stock_total}</td>
                      <td data-label="Estado">
                        <span className={`tag ${sinExistencias ? "tag-bajo" : "tag-ok"}`}>{sinExistencias ? "Sin existencias" : "Disponible"}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (vista === "detalle" && productoDetalle) {
    return (
      <div className="productos-page">
        <span className="back-link" onClick={() => setVista("lista")}>
          ← Volver al inventario
        </span>

        <h2 className="detalle-titulo">{productoDetalle.nombre}</h2>
        <p className="sub">
          {productoDetalle.marca} · {productoDetalle.categoria?.nombre ?? "Sin categoría"}
        </p>

        <AvisosInventario productos={productos} aviso={aviso} />
        {error && <div className="banner-error">{error}</div>}

        <div className="detalle-grid">
          <div className="detalle-card">
            <div className="info-row">
              <span>Codigo de barras</span>
              <span>{productoDetalle.codigo_barras ?? "—"}</span>
            </div>
            <div className="info-row">
              <span>Stock actual</span>
              <span>{productoDetalle.stock_total}</span>
            </div>
            <div className="info-row">
              <span>Precio público</span>
              <span>${productoDetalle.precio_venta_publico}</span>
            </div>
            <div className="info-row">
              <span>Caducidad</span>
              <span>{productoDetalle.proximo_a_vencer ?? "—"}</span>
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => abrirFormularioMovimiento(productoDetalle.id)}>
                + Registrar movimiento
              </button>
            </div>
          </div>

          <div className="detalle-card">
            <h3>Lotes</h3>
            {productoDetalle.lotes?.length === 0 ? (
              <p className="sub">No hay lotes registrados.</p>
            ) : (
              <table className="tabla-productos">
                <thead>
                  <tr>
                    <th>Ingreso</th>
                    <th>Stock</th>
                    <th>Caducidad</th>
                  </tr>
                </thead>
                <tbody>
                  {productoDetalle.lotes?.map((lote) => (
                    <tr key={lote.id}>
                      <td>{lote.Fecha_ingreso || "—"}</td>
                      <td>{lote.Cantidad}</td>
                      <td>{lote.Fecha_vencimiento || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (vista === "crear") {
    return (
      <div className="productos-page">
        <span className="back-link" onClick={() => setVista("lista")}>
          ← Cancelar
        </span>
        <ProductoForm
          categorias={categorias}
          onSubmit={handleCrearProducto}
          onCancel={() => setVista("lista")}
        />
      </div>
    );
  }

  if (vista === "movimiento") {
    return (
      <div className="productos-page">
        <span className="back-link" onClick={() => setVista(productoSeleccionadoId ? "detalle" : "lista")}>
          ← Cancelar
        </span>
        <MovimientoForm
          productos={productos}
          productoInicialId={productoSeleccionadoId}
          onSubmit={handleMovimientoSubmit}
          onCancel={() => setVista(productoSeleccionadoId ? "detalle" : "lista")}
        />
      </div>
    );
  }

  return null;
}
