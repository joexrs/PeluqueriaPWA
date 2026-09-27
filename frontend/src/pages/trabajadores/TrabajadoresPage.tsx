import { useEffect, useMemo, useState } from "react";
import { obtenerTrabajadores, type TrabajadorRow } from "./trabajadoresService";

export default function TrabajadoresPage() {
  const [trabajadores, setTrabajadores] = useState<TrabajadorRow[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        setLoading(true);
        const data = await obtenerTrabajadores();
        if (!cancelado) {
          setTrabajadores(data);
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
              </tr>
            </thead>
            <tbody>
              {trabajadoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sin-resultados">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
