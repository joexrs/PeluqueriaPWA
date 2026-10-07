import { useState, type FormEvent } from "react";
import type { CategoriaProductoRow } from "./productosService";
import type { CrearProductoPayload } from "./types";

interface Props {
  categorias: CategoriaProductoRow[];
  onSubmit: (data: CrearProductoPayload) => Promise<void> | void;
  onCancel: () => void;
}

const formVacio = {
  nombre: "",
  descripcion: "",
  marca: "",
  categoria_id: "",
  codigo_barras: "",
  precio_venta_publico: "",
};

export default function ProductoForm({ categorias, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nombre = form.nombre.trim();
    const precio = Number(form.precio_venta_publico);

    if (!nombre) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (Number.isNaN(precio) || precio < 0) {
      setError("El precio de venta debe ser un número válido.");
      return;
    }

    try {
      await onSubmit({
        Nombre: nombre,
        Descripcion: form.descripcion.trim() || null,
        Marca: form.marca.trim() || null,
        Categoria_id: form.categoria_id || null,
        Codigo: form.codigo_barras.trim() || null,
        Precio: precio,
      });
      setError(null);
      setForm(formVacio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto.");
    }
  }

  return (
    <form className="inventario-producto-form" onSubmit={handleSubmit}>
      <h2>Nuevo producto</h2>

      {error && <div className="banner banner-error">⚠️ {error}</div>}

      <label>
        Nombre *
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
        />
      </label>

      <label>
        Descripción
        <textarea
          rows={3}
          value={form.descripcion}
          onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
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
        Código
        <input
          type="text"
          value={form.codigo_barras}
          onChange={(e) => setForm((prev) => ({ ...prev, codigo_barras: e.target.value }))}
        />
      </label>

      <label>
        Precio *
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
