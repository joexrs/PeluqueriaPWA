import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  crearServicio,
  eliminarServicio,
  obtenerCategoriasServicios,
  obtenerServicios,
  actualizarServicio,
  type CategoriaServicioRow,
  type ServicioRow,
} from "./serviciosService";
import "./servicios.css";

type Vista = "lista" | "detalle" | "form";

interface FormState {
  nombre: string;
  categoria_id: string;
  descripcion: string;
  precio_base: string;
  duracion_minutos: string;
  tiempo_limpieza_minutos: string;
  aforo_maximo_diario: string;
  aforo_simultaneo_maximo: string;
}

const formVacio: FormState = {
  nombre: "",
  categoria_id: "",
  descripcion: "",
  precio_base: "",
  duracion_minutos: "",
  tiempo_limpieza_minutos: "5",
  aforo_maximo_diario: "10",
  aforo_simultaneo_maximo: "2",
};

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<ServicioRow[]>([]);
  const [categorias, setCategorias] = useState<CategoriaServicioRow[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [servicioSeleccionadoId, setServicioSeleccionadoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio);

  useEffect(() => {
    let cancelled = false;

    const cargarDatos = async () => {
      try {
        setLoading(true);
        const [serviciosData, categoriasData] = await Promise.all([
          obtenerServicios(),
          obtenerCategoriasServicios(),
        ]);

        if (!cancelled) {
          setServicios(serviciosData);
          setCategorias(categoriasData);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los servicios.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void cargarDatos();

    return () => {
      cancelled = true;
    };
  }, []);

  const serviciosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return servicios;
    return servicios.filter((s) => {
      const texto = `${s.nombre} ${s.descripcion ?? ""} ${s.categoria?.nombre ?? ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [servicios, busqueda]);

  const servicioDetalle = servicios.find((s) => s.id === servicioSeleccionadoId) ?? null;

  function resetFormulario() {
    setForm(formVacio);
    setEditandoId(null);
    setError(null);
  }

  function abrirDetalle(id: string) {
    setServicioSeleccionadoId(id);
    setVista("detalle");
    setError(null);
  }

  function abrirFormulario(id?: string) {
    if (id) {
      const servicio = servicios.find((s) => s.id === id);
      if (servicio) {
        setEditandoId(servicio.id);
        setForm({
          nombre: servicio.nombre,
          categoria_id: servicio.categoria_id ?? "",
          descripcion: servicio.descripcion ?? "",
          precio_base: String(servicio.precio_base),
          duracion_minutos: String(servicio.duracion_minutos),
          tiempo_limpieza_minutos: String(servicio.tiempo_limpieza_minutos),
          aforo_maximo_diario: String(servicio.aforo_maximo_diario),
          aforo_simultaneo_maximo: String(servicio.aforo_simultaneo_maximo),
        });
      }
    } else {
      resetFormulario();
      setVista("form");
      return;
    }
    setVista("form");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.nombre.trim() || !form.precio_base.trim() || !form.duracion_minutos.trim()) {
      setError("Completa nombre, precio y duración antes de guardar.");
      return;
    }

    const precioBase = Number(form.precio_base);
    const duracion = Number(form.duracion_minutos);
    const tiempoLimpieza = Number(form.tiempo_limpieza_minutos);
    const aforoMaximo = Number(form.aforo_maximo_diario);
    const aforoSimultaneo = Number(form.aforo_simultaneo_maximo);

    if (Number.isNaN(precioBase) || precioBase < 0) {
      setError("El precio debe ser un número válido.");
      return;
    }
    if (Number.isNaN(duracion) || duracion <= 0) {
      setError("La duración debe ser mayor que 0.");
      return;
    }
    if (Number.isNaN(tiempoLimpieza) || tiempoLimpieza < 0) {
      setError("El tiempo de limpieza no puede ser negativo.");
      return;
    }
    if (Number.isNaN(aforoMaximo) || aforoMaximo <= 0) {
      setError("El aforo diario debe ser mayor que 0.");
      return;
    }
    if (Number.isNaN(aforoSimultaneo) || aforoSimultaneo <= 0) {
      setError("El aforo simultáneo debe ser mayor que 0.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      categoria_id: form.categoria_id || null,
      descripcion: form.descripcion.trim() || null,
      precio_base: precioBase,
      duracion_minutos: duracion,
      tiempo_limpieza_minutos: tiempoLimpieza,
      aforo_maximo_diario: aforoMaximo,
      aforo_simultaneo_maximo: aforoSimultaneo,
    };

    try {
      if (editandoId) {
        const actualizado = await actualizarServicio(editandoId, payload);
        setServicios((prev) => prev.map((s) => (s.id === actualizado.id ? actualizado : s)));
        setServicioSeleccionadoId(actualizado.id);
      } else {
        const creado = await crearServicio(payload);
        setServicios((prev) => [creado, ...prev]);
        setServicioSeleccionadoId(creado.id);
      }
      setError(null);
      setVista("detalle");
      setForm(formVacio);
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el servicio.");
    }
  }

  async function handleDelete(id: string) {
    const confirmar = window.confirm("¿Seguro que quieres eliminar este servicio?");
    if (!confirmar) return;

    try {
      await eliminarServicio(id);
      setServicios((prev) => prev.filter((s) => s.id !== id));
      if (servicioSeleccionadoId === id) {
        setServicioSeleccionadoId(null);
      }
      if (editandoId === id) {
        resetFormulario();
      }
      setError(null);
      setVista("lista");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el servicio.");
    }
  }

  if (vista === "lista") {
    return (
      <div className="servicios-page">
        <div className="toolbar">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar servicio..."
            disabled={loading || servicios.length === 0}
          />
          <button className="btn btn-primary" onClick={() => abrirFormulario()}>
            + Nuevo servicio
          </button>
        </div>

        {error && <div className="banner-error">{error}</div>}

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <strong>Cargando servicios...</strong>
          </div>
        ) : servicios.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✂️</div>
            <strong>Todavía no hay servicios registrados</strong>
          </div>
        ) : (
          <table className="tabla-servicios">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Duración</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {serviciosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sin-resultados">
                    Ningún servicio coincide con "{busqueda}".
                  </td>
                </tr>
              ) : (
                serviciosFiltrados.map((servicio) => (
                  <tr key={servicio.id} className="fila-clickable" onClick={() => abrirDetalle(servicio.id)}>
                    <td data-label="Nombre">{servicio.nombre}</td>
                    <td data-label="Categoría">{servicio.categoria?.nombre ?? "Sin categoría"}</td>
                    <td data-label="Precio">${servicio.precio_base}</td>
                    <td data-label="Duración">{servicio.duracion_minutos} min</td>
                    <td data-label="Acciones">
                      <div className="acciones-cell" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-ghost small" onClick={() => abrirFormulario(servicio.id)}>
                          Editar
                        </button>
                        <button className="btn btn-danger small" onClick={() => void handleDelete(servicio.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (vista === "detalle" && servicioDetalle) {
    return (
      <div className="servicios-page">
        <span className="back-link" onClick={() => setVista("lista")}>
          ← Volver a servicios
        </span>

        <h2 className="detalle-titulo">{servicioDetalle.nombre}</h2>
        <p className="sub">{servicioDetalle.categoria?.nombre ?? "Sin categoría"}</p>

        <div className="detalle-grid">
          <div className="detalle-card">
            <div className="info-row">
              <span>Descripción</span>
              <span>{servicioDetalle.descripcion ?? "—"}</span>
            </div>
            <div className="info-row">
              <span>Precio base</span>
              <span>${servicioDetalle.precio_base}</span>
            </div>
            <div className="info-row">
              <span>Duración</span>
              <span>{servicioDetalle.duracion_minutos} minutos</span>
            </div>
            <div className="info-row">
              <span>Limpieza</span>
              <span>{servicioDetalle.tiempo_limpieza_minutos} minutos</span>
            </div>
            <div className="info-row">
              <span>Aforo diario</span>
              <span>{servicioDetalle.aforo_maximo_diario}</span>
            </div>
            <div className="info-row">
              <span>Aforo simultáneo</span>
              <span>{servicioDetalle.aforo_simultaneo_maximo}</span>
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => abrirFormulario(servicioDetalle.id)}>
                Editar
              </button>
              <button className="btn btn-danger" onClick={() => void handleDelete(servicioDetalle.id)}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (vista === "form") {
    return (
      <div className="servicios-page">
        <span className="back-link" onClick={() => setVista(servicioSeleccionadoId ? "detalle" : "lista")}>
          ← Cancelar
        </span>

        <form className="servicio-form" onSubmit={handleSubmit}>
          <h2>{editandoId ? "Editar servicio" : "Nuevo servicio"}</h2>

          {error && <div className="banner-error">{error}</div>}

          <label>
            Nombre
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
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
            Descripción
            <textarea
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
            />
          </label>

          <label>
            Precio base ($)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.precio_base}
              onChange={(e) => setForm((prev) => ({ ...prev, precio_base: e.target.value }))}
            />
          </label>

          <label>
            Duración (minutos)
            <input
              type="number"
              min="1"
              value={form.duracion_minutos}
              onChange={(e) => setForm((prev) => ({ ...prev, duracion_minutos: e.target.value }))}
            />
          </label>

          <label>
            Tiempo de limpieza (minutos)
            <input
              type="number"
              min="0"
              value={form.tiempo_limpieza_minutos}
              onChange={(e) => setForm((prev) => ({ ...prev, tiempo_limpieza_minutos: e.target.value }))}
            />
          </label>

          <label>
            Aforo máximo diario
            <input
              type="number"
              min="1"
              value={form.aforo_maximo_diario}
              onChange={(e) => setForm((prev) => ({ ...prev, aforo_maximo_diario: e.target.value }))}
            />
          </label>

          <label>
            Aforo simultáneo máximo
            <input
              type="number"
              min="1"
              value={form.aforo_simultaneo_maximo}
              onChange={(e) => setForm((prev) => ({ ...prev, aforo_simultaneo_maximo: e.target.value }))}
            />
          </label>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setVista(servicioSeleccionadoId ? "detalle" : "lista")}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editandoId ? "Guardar cambios" : "Guardar servicio"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
