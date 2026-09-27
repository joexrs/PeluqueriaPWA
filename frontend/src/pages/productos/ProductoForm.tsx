import { useState, type FormEvent } from "react";
import type { CategoriaProductoRow, ProveedorRow } from "./productosService";
import type { CrearProductoPayload } from "./types";

interface Props {
  categorias: CategoriaProductoRow[];
  proveedores: ProveedorRow[];
  onSubmit: (data: CrearProductoPayload) => Promise<void> | void;
  onCancel: () => void;
}

const formVacio = {
  nombre: "",
  marca: "",
  categoria_id: "",
  proveedor_id: "",
  codigo_barras: "",
  unidad_medida: "UNIDAD",
  stock_minimo: "5",
  precio_venta_publico: "",
};

export default function ProductoForm({ categorias, proveedores, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nombre = form.nombre.trim();
    const marca = form.marca.trim();
    const precio = Number(form.precio_venta_publico);

    if (!nombre || !marca) {
      setError("Nombre y marca son obligatorios.");
      return;
    }
    if (Number.isNaN(precio) || precio < 0) {
      setError("El precio de venta debe ser un número válido.");
      return;
    }

    try {
      await onSubmit({
        nombre,
        marca,
        categoria_id: form.categoria_id || null,
        proveedor_id: form.proveedor_id || null,
        codigo_barras: form.codigo_barras.trim() || null,
        unidad_medida: form.unidad_medida || "UNIDAD",
        stock_minimo: Number(form.stock_minimo) || 0,
        precio_venta_publico: precio,
      });
      setError(null);
      setForm(formVacio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto.");
    }
  }

  return (
    <form className="producto-form" onSubmit={handleSubmit}>
      <h2>Nuevo producto</h2>

      {error && <div className="banner banner-error">⚠️ {error}</div>}

      <label>
        Nombre
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
        />
      </label>

      <label>
        Marca
        <input
          type="text"
          value={form.marca}
          onChange={(e) => setForm((prev) => ({ ...prev, marca: e.target.value }))}
        />
      </label>

      <label>
        Categoría
        <select
          value={form.categoria_id}
          onChange={(e) => setForm((prev) => ({ ...prev, categoria_id: e.target.value }))}
        >
          <option value="">Sin categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </label>

      <label>
        Proveedor
        <select
          value={form.proveedor_id}
          onChange={(e) => setForm((prev) => ({ ...prev, proveedor_id: e.target.value }))}
        >
          <option value="">Sin proveedor</option>
          {proveedores.map((proveedor) => (
            <option key={proveedor.id} value={proveedor.id}>
              {proveedor.razon_social}
            </option>
          ))}
        </select>
      </label>

      <label>
        Código de barras
        <input
          type="text"
          value={form.codigo_barras}
          onChange={(e) => setForm((prev) => ({ ...prev, codigo_barras: e.target.value }))}
        />
      </label>

      <label>
        Unidad de medida
        <input
          type="text"
          value={form.unidad_medida}
          onChange={(e) => setForm((prev) => ({ ...prev, unidad_medida: e.target.value }))}
        />
      </label>

      <label>
        Stock mínimo
        <input
          type="number"
          min="0"
          value={form.stock_minimo}
          onChange={(e) => setForm((prev) => ({ ...prev, stock_minimo: e.target.value }))}
        />
      </label>

      <label>
        Precio venta público
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.precio_venta_publico}
          onChange={(e) => setForm((prev) => ({ ...prev, precio_venta_publico: e.target.value }))}
        />
      </label>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary">
          Guardar producto
        </button>
      </div>
    </form>
  );
}
