import { useMemo, useState, type FormEvent } from "react";
import type { ProductoConLotes, RegistrarEntradaPayload, RegistrarSalidaPayload } from "./types";

interface Props {
  productos: ProductoConLotes[];
  onSubmit: (data: RegistrarEntradaPayload | RegistrarSalidaPayload) => void | Promise<void>;
  onCancel: () => void;
}

export default function MovimientoForm({ productos, onSubmit, onCancel }: Props) {
  const [productoId, setProductoId] = useState(productos[0]?.id ?? "");
  const [tipo, setTipo] = useState<"ENTRADA_COMPRA" | "SALIDA_USO_SERVICIO">("ENTRADA_COMPRA");
  const [cantidad, setCantidad] = useState("");
  const [numeroLote, setNumeroLote] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [fechaCaducidad, setFechaCaducidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId) ?? null,
    [productos, productoId]
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cantidadNum = Number(cantidad);

    if (!productoId) {
      setError("Selecciona un producto.");
      return;
    }
    if (!cantidadNum || cantidadNum <= 0) {
      setError("Ingresa una cantidad válida mayor que 0.");
      return;
    }

    if (tipo === "ENTRADA_COMPRA") {
      if (!numeroLote.trim()) {
        setError("Es necesario indicar el número de lote.");
        return;
      }
      const costo = Number(costoUnitario);
      if (!costoUnitario || Number.isNaN(costo) || costo < 0) {
        setError("El costo unitario no es válido.");
        return;
      }

      void onSubmit({
        producto_id: productoId,
        numero_lote: numeroLote.trim(),
        costo_unitario: costo,
        cantidad: cantidadNum,
        fecha_caducidad: fechaCaducidad || null,
        motivo: motivo.trim() || `Entrada de producto ${productoSeleccionado?.nombre ?? ""}`,
      });
      return;
    }

    const loteId = productoSeleccionado?.lotes?.[0]?.id ?? "";
    if (!loteId) {
      setError("Este producto no tiene lote disponible para registrar una salida.");
      return;
    }

    void onSubmit({
      lote_id: loteId,
      producto_id: productoId,
      cantidad: cantidadNum,
      tipo: "SALIDA_USO_SERVICIO",
      motivo: motivo.trim() || `Salida de producto ${productoSeleccionado?.nombre ?? ""}`,
      usuario_id: undefined,
    });
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
              {p.nombre} (stock: {p.stock_total})
            </option>
          ))}
        </select>
      </label>

      <div className="toggle-group">
        <button type="button" className={`toggle-btn ${tipo === "ENTRADA_COMPRA" ? "active" : ""}`} onClick={() => setTipo("ENTRADA_COMPRA")}>
          Entrada
        </button>
        <button type="button" className={`toggle-btn ${tipo === "SALIDA_USO_SERVICIO" ? "active" : ""}`} onClick={() => setTipo("SALIDA_USO_SERVICIO")}>
          Salida
        </button>
      </div>

      <label>
        Cantidad
        <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Ej. 5" />
      </label>

      {tipo === "ENTRADA_COMPRA" && (
        <>
          <label>
            Número de lote
            <input type="text" value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} placeholder="Ej. L-1001" />
          </label>

          <label>
            Costo unitario
            <input type="number" min="0" step="0.01" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} placeholder="0.00" />
          </label>

          <label>
            Fecha de caducidad (opcional)
            <input type="date" value={fechaCaducidad} onChange={(e) => setFechaCaducidad(e.target.value)} />
          </label>
        </>
      )}

      <label>
        Motivo
        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Ajuste de stock" />
      </label>

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
