import { useMemo, useState, type FormEvent } from "react";
import type { ProductoConLotes, RegistrarEntradaPayload, RegistrarSalidaPayload } from "./types";

interface Props {
  productos: ProductoConLotes[];
  productoInicialId?: string | null;
  onSubmit: (data: RegistrarEntradaPayload | RegistrarSalidaPayload) => void | Promise<void>;
  onCancel: () => void;
}

export default function MovimientoForm({ productos, productoInicialId, onSubmit, onCancel }: Props) {
  const [productoId, setProductoId] = useState(
    productoInicialId ?? productos[0]?.id ?? "",
  );
  const [tipo, setTipo] = useState<"ENTRADA_COMPRA" | "SALIDA_USO_SERVICIO">("ENTRADA_COMPRA");
  const [cantidad, setCantidad] = useState("");
  const [fechaCaducidad, setFechaCaducidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId) ?? null,
    [productos, productoId]
  );
  const hoy = new Date();
  const fechaMinima = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cantidadNum = Number(cantidad);

    if (!productoId) {
      setError("Selecciona un producto.");
      return;
    }
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      setError("Ingresa una cantidad entera mayor que 0.");
      return;
    }

    if (tipo === "ENTRADA_COMPRA") {
      if (!fechaCaducidad) {
        setError("Indica la fecha de caducidad del lote.");
        return;
      }
    } else if (cantidadNum > Number(productoSeleccionado?.stock_total ?? 0)) {
      setError("La cantidad supera el stock disponible del producto.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      if (tipo === "ENTRADA_COMPRA") {
        await onSubmit({
          producto_id: productoId,
          cantidad: cantidadNum,
          fecha_caducidad: fechaCaducidad,
        });
      } else {
        await onSubmit({
          producto_id: productoId,
          cantidad: cantidadNum,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="mov-form" onSubmit={handleSubmit}>
      <h2>Registrar movimiento</h2>
      <p className="sub">{productoSeleccionado?.nombre ?? "Selecciona un producto"}</p>

      {error && <div className="banner banner-error">⚠️ {error}</div>}

      <label>
        Producto
        <select
          value={productoId}
          onChange={(e) => {
            const id = e.target.value;
            setProductoId(id);
          }}
        >
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} (stock: {p.stock_total})
            </option>
          ))}
        </select>
      </label>

      <div className="toggle-group">
        <button type="button" className={`toggle-btn ${tipo === "ENTRADA_COMPRA" ? "active" : ""}`} onClick={() => setTipo("ENTRADA_COMPRA")} disabled={guardando}>
          Entrada
        </button>
        <button type="button" className={`toggle-btn ${tipo === "SALIDA_USO_SERVICIO" ? "active" : ""}`} onClick={() => setTipo("SALIDA_USO_SERVICIO")} disabled={guardando}>
          Salida
        </button>
      </div>

      {tipo === "SALIDA_USO_SERVICIO" && (
        <div className="movement-note" role="status">
          La salida descontara primero los lotes con vencimiento mas proximo. Los lotes vencidos solo se incluyen en una salida manual.
        </div>
      )}

      <label>
        Cantidad
        <input
          type="number"
          min={1}
          max={tipo === "SALIDA_USO_SERVICIO" ? Number(productoSeleccionado?.stock_total ?? 0) : undefined}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="Ej. 5"
        />
      </label>

      {tipo === "ENTRADA_COMPRA" && (
        <>
          <label>
            Fecha de caducidad *
            <input type="date" min={fechaMinima} value={fechaCaducidad} onChange={(e) => setFechaCaducidad(e.target.value)} required />
          </label>
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={guardando || !productos.length}>
          {guardando ? "Guardando..." : "Guardar movimiento"}
        </button>
      </div>
    </form>
  );
}
