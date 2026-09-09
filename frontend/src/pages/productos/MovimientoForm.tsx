import { useState } from "react";
import type { Producto, TipoMovimiento } from "./types";

interface MovimientoData {
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  caducidad?: string;
}

interface Props {
  productos: Producto[];
  productoIdInicial: string;
  onSubmit: (data: MovimientoData) => string | null; // devuelve mensaje de error, o null si OK
  onCancel: () => void;
}

export default function MovimientoForm({ productos, productoIdInicial, onSubmit, onCancel }: Props) {
  const [productoId, setProductoId] = useState(productoIdInicial);
  const [tipo, setTipo] = useState<TipoMovimiento>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [caducidad, setCaducidad] = useState("");
  const [error, setError] = useState<string | null>(null);

  const productoSeleccionado = productos.find((p) => p.id === productoId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cantidadNum = Number(cantidad);
    if (!cantidadNum || cantidadNum <= 0) {
      setError("Ingresa una cantidad válida (mayor a 0).");
      return;
    }
    const mensaje = onSubmit({ productoId, tipo, cantidad: cantidadNum, caducidad: caducidad || undefined });
    if (mensaje) setError(mensaje);
  }

  return (
    <form className="mov-form" onSubmit={handleSubmit}>
      <h2>Registrar movimiento</h2>
      <p className="sub">{productoSeleccionado?.nombre ?? "Selecciona un producto"}</p>

      {error && <div className="banner banner-error">⚠️ {error}</div>}

      <label>
        Producto
        <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} (stock: {p.stock})
            </option>
          ))}
        </select>
      </label>

      <div className="toggle-group">
        <button type="button" className={`toggle-btn ${tipo === "entrada" ? "active" : ""}`} onClick={() => setTipo("entrada")}>
          Entrada
        </button>
        <button type="button" className={`toggle-btn ${tipo === "salida" ? "active" : ""}`} onClick={() => setTipo("salida")}>
          Salida
        </button>
      </div>

      <label>
        Cantidad
        <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Ej. 5" />
      </label>

      {tipo === "entrada" && (
        <label>
          Fecha de caducidad (opcional)
          <input type="date" value={caducidad} onChange={(e) => setCaducidad(e.target.value)} />
        </label>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary">
          Guardar movimiento
        </button>
      </div>
    </form>
  );
}
