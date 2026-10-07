import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  crearPromocion,
  eliminarPromocion,
  obtenerPromociones,
  actualizarPromocion,
  toggleActivarPromocion,
} from "./promocionesService";
import { obtenerServicios, type ServicioRow } from "../servicios/serviciosService";
import type { Promocion } from "./types";
import "./promociones.css";

type Vista = "lista" | "detalle" | "form";

interface FormState {
  titulo: string;
  descripcion: string;
  descuento: string;
  servicioId: string;
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
}

const formVacio: FormState = {
  titulo: "",
  descripcion: "",
  descuento: "",
  servicioId: "",
  fechaInicio: "",
  fechaFin: "",
  activa: true,
};

export default function PromocionesPage() {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [servicios, setServicios] = useState<ServicioRow[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [promocionSeleccionadaId, setPromocionSeleccionadaId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio);

  useEffect(() => {
    let cancelled = false;

    const cargarPromociones = async () => {
      try {
        setLoading(true);
        const [data, serviciosData] = await Promise.all([obtenerPromociones(), obtenerServicios()]);
        if (!cancelled) {
          setPromociones(data);
          setServicios(serviciosData);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "No se pudieron cargar las promociones."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void cargarPromociones();

    return () => {
      cancelled = true;
    };
  }, []);

  const promocionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return promociones;
    return promociones.filter((p) => {
      const texto = `${p.titulo} ${p.descripcion} ${p.servicioNombre ?? ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [promociones, busqueda]);

  const promocionDetalle = promociones.find((p) => p.id === promocionSeleccionadaId) ?? null;

  function resetFormulario() {
    setForm(formVacio);
    setEditandoId(null);
    setError(null);
  }

  function abrirDetalle(id: string) {
    setPromocionSeleccionadaId(id);
    setVista("detalle");
    setError(null);
  }

  function abrirFormulario(id?: string) {
    if (id) {
      const p = promociones.find((item) => item.id === id);
      if (p) {
        setEditandoId(p.id);
        setForm({
          titulo: p.titulo,
          descripcion: p.descripcion,
          descuento: String(p.descuento),
          servicioId: p.servicioId,
          fechaInicio: p.fechaInicio,
          fechaFin: p.fechaFin,
          activa: p.activa,
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

    if (!form.titulo.trim() || !form.descuento || !form.fechaInicio || !form.fechaFin) {
      setError("Completa todos los campos antes de guardar.");
      return;
    }

    const descuento = Number(form.descuento);
    if (isNaN(descuento) || descuento < 0 || descuento > 100) {
      setError("El descuento debe ser un valor entre 0 y 100.");
      return;
    }

    if (form.fechaFin < form.fechaInicio) {
      setError("La fecha de fin no puede ser anterior a la fecha de inicio.");
      return;
    }

    const payload: Omit<Promocion, "id" | "servicioNombre"> = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      descuento,
      servicioId: form.servicioId,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      activa: form.activa,
    };

    try {
      if (editandoId) {
        const actualizada = await actualizarPromocion(editandoId, payload);
        setPromociones((prev) => prev.map((p) => (p.id === actualizada.id ? actualizada : p)));
        setPromocionSeleccionadaId(actualizada.id);
      } else {
        const creada = await crearPromocion(payload);
        setPromociones((prev) => [...prev, creada]);
        setPromocionSeleccionadaId(creada.id);
      }
      setError(null);
      setVista("detalle");
      setForm(formVacio);
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la promoción.");
    }
  }

  async function handleDelete(id: string) {
    const confirmar = window.confirm("¿Seguro que quieres eliminar esta promoción?");
    if (!confirmar) return;

    try {
      await eliminarPromocion(id);
      setPromociones((prev) => prev.filter((p) => p.id !== id));
      if (promocionSeleccionadaId === id) setPromocionSeleccionadaId(null);
      if (editandoId === id) resetFormulario();
      setError(null);
      setVista("lista");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la promoción.");
    }
  }

  async function handleToggleActiva(id: string) {
    try {
      const actualizada = await toggleActivarPromocion(id);
      setPromociones((prev) => prev.map((p) => (p.id === actualizada.id ? actualizada : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la promoción.");
    }
  }

  // ---------- Vista: Lista ----------
  if (vista === "lista") {
    return (
      <div className="promociones-page">
        <div className="toolbar">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar promoción..."
            disabled={loading || promociones.length === 0}
          />
          <button className="btn btn-primary" onClick={() => abrirFormulario()}>
            + Nueva promoción
          </button>
        </div>

        {error && <div className="banner-error">{error}</div>}

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <strong>Cargando promociones...</strong>
          </div>
        ) : promociones.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏷️</div>
            <strong>Todavía no hay promociones registradas</strong>
          </div>
        ) : (
          <table className="tabla-promociones">
            <thead>
              <tr>
                <th>Título</th>
                <th>Servicio</th>
                <th>Descuento</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {promocionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sin-resultados">
                    Ninguna promoción coincide con "{busqueda}".
                  </td>
                </tr>
              ) : (
                promocionesFiltradas.map((p) => (
                  <tr
                    key={p.id}
                    className="fila-clickable"
                    onClick={() => abrirDetalle(p.id)}
                  >
                    <td data-label="Título">{p.titulo}</td>
                    <td data-label="Servicio">{p.servicioNombre ?? "Todos los servicios"}</td>
                    <td data-label="Descuento">{p.descuento}%</td>
                    <td data-label="Vigencia">
                      {p.fechaInicio} → {p.fechaFin}
                    </td>
                    <td data-label="Estado">
                      <span className={`tag ${p.activa ? "tag-activa" : "tag-inactiva"}`}>
                        {p.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <div className="acciones-cell" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`btn btn-toggle small ${!p.activa ? "inactiva" : ""}`}
                          onClick={() => void handleToggleActiva(p.id)}
                        >
                          {p.activa ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          className="btn btn-ghost small"
                          onClick={() => abrirFormulario(p.id)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger small"
                          onClick={() => void handleDelete(p.id)}
                        >
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

  // ---------- Vista: Detalle ----------
  if (vista === "detalle" && promocionDetalle) {
    return (
      <div className="promociones-page">
        <span className="back-link" onClick={() => setVista("lista")}>
          ← Volver a promociones
        </span>

        <h2 className="detalle-titulo">{promocionDetalle.titulo}</h2>
        <p className="sub">
          <span className="tag tag-tipo">{promocionDetalle.servicioNombre ?? "Todos los servicios"}</span>
          &nbsp;·&nbsp;
          <span className={`tag ${promocionDetalle.activa ? "tag-activa" : "tag-inactiva"}`}>
            {promocionDetalle.activa ? "Activa" : "Inactiva"}
          </span>
        </p>

        <div className="detalle-grid">
          <div className="detalle-card">
            <div className="info-row">
              <span>Descripción</span>
              <span>{promocionDetalle.descripcion}</span>
            </div>
            <div className="info-row">
              <span>Descuento</span>
              <span>{promocionDetalle.descuento}%</span>
            </div>
            <div className="info-row">
              <span>Fecha inicio</span>
              <span>{promocionDetalle.fechaInicio}</span>
            </div>
            <div className="info-row">
              <span>Fecha fin</span>
              <span>{promocionDetalle.fechaFin}</span>
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button
                className={`btn btn-toggle ${!promocionDetalle.activa ? "inactiva" : ""}`}
                onClick={() => void handleToggleActiva(promocionDetalle.id)}
              >
                {promocionDetalle.activa ? "Desactivar" : "Activar"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => abrirFormulario(promocionDetalle.id)}
              >
                Editar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => void handleDelete(promocionDetalle.id)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Vista: Formulario ----------
  if (vista === "form") {
    return (
      <div className="promociones-page">
        <span
          className="back-link"
          onClick={() => setVista(promocionSeleccionadaId ? "detalle" : "lista")}
        >
          ← Cancelar
        </span>

        <form className="promocion-form" onSubmit={handleSubmit}>
          <h2>{editandoId ? "Editar promoción" : "Nueva promoción"}</h2>

          {error && <div className="banner-error">{error}</div>}

          <label>
            Título
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
          </label>

          <label>
            Descripción
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
            />
          </label>

          <div className="form-row">
            <label>
              Servicio
              <select
                value={form.servicioId}
                onChange={(e) => setForm((prev) => ({ ...prev, servicioId: e.target.value }))}
              >
                <option value="">Todos los servicios</option>
                {servicios.map((servicio) => (
                  <option key={servicio.ID} value={servicio.ID}>
                    {servicio.Nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Descuento (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.descuento}
                onChange={(e) => setForm((prev) => ({ ...prev, descuento: e.target.value }))}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Fecha inicio
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm((prev) => ({ ...prev, fechaInicio: e.target.value }))}
              />
            </label>

            <label>
              Fecha fin
              <input
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
              />
            </label>
          </div>

          <label style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm((prev) => ({ ...prev, activa: e.target.checked }))}
            />
            Promoción activa
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setVista(promocionSeleccionadaId ? "detalle" : "lista")}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editandoId ? "Guardar cambios" : "Guardar promoción"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
