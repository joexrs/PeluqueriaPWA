import { useEffect, useMemo, useState } from "react";
import { obtenerTrabajadores, type TrabajadorRow } from "./trabajadoresService";
import { obtenerServicios, type ServicioRow } from "../servicios/serviciosService";
import { guardarServiciosTrabajador, obtenerServiciosTrabajador } from "../usuarios/usuariosService";
import "./trabajadores.css";

export default function TrabajadoresPage() {
  const [trabajadores, setTrabajadores] = useState<TrabajadorRow[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servicios, setServicios] = useState<ServicioRow[]>([]);
  const [editando, setEditando] = useState<TrabajadorRow | null>(null);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        setLoading(true);
        const [data, serviciosData] = await Promise.all([obtenerTrabajadores(), obtenerServicios()]);
        if (!cancelado) {
          setTrabajadores(data);
          setServicios(serviciosData);
          setError(null);
        }
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los trabajadores.");
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function editarServicios(trabajador: TrabajadorRow) {
    setEditando(trabajador);
    setServiciosSeleccionados([]);
    setError(null);
    try {
      setServiciosSeleccionados(await obtenerServiciosTrabajador(trabajador.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los servicios del trabajador.");
      setEditando(null);
    }
  }

  async function guardarServicios() {
    if (!editando) return;
    try {
      setGuardando(true);
      await guardarServiciosTrabajador(editando.id, serviciosSeleccionados);
      setTrabajadores(await obtenerTrabajadores());
      setEditando(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los servicios.");
    } finally {
      setGuardando(false);
    }
  }

  const trabajadoresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return trabajadores;

    return trabajadores.filter((trabajador) => {
      const texto = `${trabajador.nombre} ${trabajador.apellido} ${trabajador.email} ${trabajador.servicios.join(" ")}`.toLowerCase();
      return texto.includes(q);
    });
  }, [trabajadores, busqueda]);

  return (
    <div className="usuarios-page">
      <div className="toolbar">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar trabajador..."
        />
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <strong>Cargando trabajadores...</strong>
        </div>
      ) : (
        <div className="panel-table">
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Servicios</th>
                <th>Comisión</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {trabajadoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sin-resultados">
                    Ningún trabajador coincide con "{busqueda}".
                  </td>
                </tr>
              ) : (
                trabajadoresFiltrados.map((trabajador) => (
                  <tr key={trabajador.id}>
                    <td>
                      {trabajador.nombre} {trabajador.apellido}
                    </td>
                    <td>{trabajador.email}</td>
                    <td>
                      {trabajador.servicios.length > 0
                        ? trabajador.servicios.join(", ")
                        : "Sin servicios asignados"}
                    </td>
                    <td>{trabajador.comision_porcentaje ?? 0}%</td>
                    <td>
                      <span className={`tag ${trabajador.activo ? "activo" : "inactivo"}`}>
                        {trabajador.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <button type="button" className="btn btn-ghost small" onClick={() => void editarServicios(trabajador)}>
                        Editar servicios
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <div className="trabajador-modal-overlay" onClick={() => !guardando && setEditando(null)}>
          <section className="usuario-form trabajador-servicios-modal" role="dialog" aria-modal="true" aria-labelledby="trabajador-servicios-titulo" onClick={(event) => event.stopPropagation()}>
            <h2 id="trabajador-servicios-titulo">Servicios de {editando.nombre} {editando.apellido}</h2>
            <fieldset className="usuario-servicios">
              <legend>Servicios que puede realizar</legend>
              {servicios.length === 0 ? <small>No hay servicios activos disponibles.</small> : servicios.map((servicio) => {
                const id = String(servicio.id ?? servicio.ID);
                return (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={serviciosSeleccionados.includes(id)}
                      onChange={(event) => setServiciosSeleccionados((actuales) => event.target.checked
                        ? [...actuales, id]
                        : actuales.filter((actual) => actual !== id))}
                    />
                    {servicio.nombre}
                  </label>
                );
              })}
            </fieldset>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={() => void guardarServicios()} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar servicios"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
