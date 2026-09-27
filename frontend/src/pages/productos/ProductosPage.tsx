import { useEffect, useMemo, useState } from "react";
import {
  crearProducto,
  obtenerCategoriasProductos,
  obtenerProductos,
  obtenerProveedores,
  registrarEntrada,
  registrarSalida,
  type CategoriaProductoRow,
  type ProveedorRow,
} from "./productosService";
import type { CrearProductoPayload, ProductoConLotes, RegistrarEntradaPayload, RegistrarSalidaPayload } from "./types";
import ProductoForm from "./ProductoForm";
import MovimientoForm from "./MovimientoForm";
import "./productos.css";

type Vista = "lista" | "detalle" | "crear" | "movimiento";

export default function ProductosPage() {
  const [productos, setProductos] = useState<ProductoConLotes[]>([]);
  const [categorias, setCategorias] = useState<CategoriaProductoRow[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function cargarDatos() {
      try {
        setLoading(true);
        const [productosData, categoriasData, proveedoresData] = await Promise.all([
          obtenerProductos(),
          obtenerCategoriasProductos(),
          obtenerProveedores(),
        ]);

        if (!cancelled) {
          setProductos(productosData);
          setCategorias(categoriasData);
          setProveedores(proveedoresData);
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
    if ("numero_lote" in data) {
      await registrarEntrada(data, undefined);
    } else {
      await registrarSalida(data);
    }

    await recargarProductos();
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
                <th>Stock mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sin-resultados">
                    Ningún producto coincide con "{busqueda}".
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((producto) => {
                  const bajo = producto.stock_total <= producto.stock_minimo;
                  return (
                    <tr key={producto.id} className="fila-clickable" onClick={() => abrirDetalle(producto.id)}>
                      <td data-label="Producto">{producto.nombre}</td>
                      <td data-label="Marca">{producto.marca}</td>
                      <td data-label="Categoría">{producto.categoria?.nombre ?? "Sin categoría"}</td>
                      <td data-label="Stock">{producto.stock_total}</td>
                      <td data-label="Stock mínimo">{producto.stock_minimo}</td>
                      <td data-label="Estado">
                        <span className={`tag ${bajo ? "tag-bajo" : "tag-ok"}`}>{bajo ? "Stock bajo" : "OK"}</span>
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
              <span>Stock mínimo</span>
              <span>{productoDetalle.stock_minimo}</span>
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
            {productoDetalle.lotes.length === 0 ? (
              <p className="sub">No hay lotes registrados.</p>
            ) : (
              <table className="tabla-productos">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Stock</th>
                    <th>Caducidad</th>
                  </tr>
                </thead>
                <tbody>
                  {productoDetalle.lotes.map((lote) => (
                    <tr key={lote.id}>
                      <td>{lote.numero_lote}</td>
                      <td>{lote.stock_actual}</td>
                      <td>{lote.fecha_caducidad ?? "—"}</td>
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
          proveedores={proveedores}
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
          onSubmit={handleMovimientoSubmit}
          onCancel={() => setVista(productoSeleccionadoId ? "detalle" : "lista")}
        />
      </div>
    );
  }

  return null;
}
