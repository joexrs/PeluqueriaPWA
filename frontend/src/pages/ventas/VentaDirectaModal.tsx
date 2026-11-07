import { useState, type FormEvent, useEffect } from "react";
import { X } from "lucide-react";
import { obtenerClientes } from "../clientes/clientesService";
import type { Cliente } from "../clientes/types";
import "./ventas.css";

interface VentaDirectaModalProps {
  onCrear: (clienteId: string) => Promise<void>;
  onCerrar: () => void;
}

export default function VentaDirectaModal({ onCrear, onCerrar }: VentaDirectaModalProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true);
        const data = await obtenerClientes();
        setClientes(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar clientes");
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, []);

  const clientesFiltrados = clientes.filter(
    (cliente) =>
      `${cliente.Nombre} ${cliente.Apellido}`.toLowerCase().includes(busqueda.toLowerCase()) ||
      cliente.DNI?.toLowerCase().includes(busqueda.toLowerCase()) ||
      cliente.Telefono?.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clienteId) {
      setError("Debes seleccionar un cliente");
      return;
    }

    try {
      setProcesando(true);
      setError(null);
      await onCrear(clienteId);
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la venta");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nueva Venta Directa</h3>
          <button type="button" className="modal-close-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {error && <div className="banner-error">{error}</div>}

          <form onSubmit={handleSubmit} className="venta-directa-form">
            <div className="form-section">
              <label>
                <span className="eyebrow">Buscar cliente</span>
                <input
                  type="text"
                  placeholder="Nombre, DNI o teléfono..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  disabled={cargando}
                />
              </label>

              <div className="clientes-select-list">
                {cargando ? (
                  <div className="empty-mini">Cargando clientes...</div>
                ) : clientesFiltrados.length === 0 ? (
                  <div className="empty-mini">
                    {busqueda ? "No se encontraron clientes" : "No hay clientes registrados"}
                  </div>
                ) : (
                  clientesFiltrados.map((cliente) => (
                    <button
                      key={cliente.ID}
                      type="button"
                      className={`cliente-select-item ${clienteId === cliente.ID ? "selected" : ""}`}
                      onClick={() => setClienteId(cliente.ID)}
                    >
                      <div className="cliente-select-info">
                        <strong>{`${cliente.Nombre} ${cliente.Apellido}`}</strong>
                        <small>
                          {cliente.DNI && `DNI: ${cliente.DNI}`}
                          {cliente.DNI && cliente.Telefono && " • "}
                          {cliente.Telefono && `Tel: ${cliente.Telefono}`}
                        </small>
                      </div>
                      {clienteId === cliente.ID && (
                        <span className="check-icon" aria-label="Seleccionado">
                          ✓
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onCerrar} disabled={procesando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!clienteId || procesando}>
                {procesando ? "Creando..." : "Crear venta"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
