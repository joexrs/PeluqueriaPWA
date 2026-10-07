import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  crearCliente,
  eliminarCliente,
  obtenerClientes,
  actualizarCliente,
  type ClienteRow,
} from "./clientesService";
import { validators } from "../../lib/validators";
import "./clientes.css";

type Vista = "lista" | "detalle" | "form";

interface FormState {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  fecha_nacimiento: string;
  notas_preferencias: string;
}

const formVacio: FormState = {
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  fecha_nacimiento: "",
  notas_preferencias: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});

  useEffect(() => {
    let cancelled = false;

    const cargarClientes = async () => {
      try {
        setLoading(true);
        const data = await obtenerClientes();
        if (!cancelled) {
          setClientes(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void cargarClientes();

    return () => {
      cancelled = true;
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;

    return clientes.filter((cliente) => {
      const texto = `${cliente.nombre} ${cliente.apellido ?? ""} ${cliente.telefono} ${cliente.email ?? ""} ${cliente.notas_preferencias ?? ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [clientes, busqueda]);

  const clienteDetalle = clientes.find((cliente) => cliente.id === clienteSeleccionadoId) ?? null;

  function resetFormulario() {
    setForm(formVacio);
    setEditandoId(null);
    setFormErrors({});
    setTouched({});
    setError(null);
  }

  function abrirDetalle(id: string) {
    setClienteSeleccionadoId(id);
    setVista("detalle");
    setError(null);
  }

  function abrirFormulario(id?: string) {
    setFormErrors({});
    setTouched({});
    setError(null);
    if (id) {
      const cliente = clientes.find((item) => item.id === id);
      if (cliente) {
        setEditandoId(cliente.id);
        setForm({
          nombre: cliente.nombre,
          apellido: cliente.apellido ?? "",
          dni: cliente.DNI ?? "",
          telefono: cliente.telefono,
          email: cliente.email ?? "",
          fecha_nacimiento: cliente.fecha_nacimiento ?? "",
          notas_preferencias: cliente.notas_preferencias ?? "",
        });
      }
    } else {
      resetFormulario();
      setVista("form");
      return;
    }

    setVista("form");
  }

  // Validate individual field
  function validateField(name: keyof FormState, value: string): string | undefined {
    switch (name) {
      case "nombre":
        return validators.required("El nombre es obligatorio").validate(value).error;
      case "apellido":
        return validators.required("El apellido es obligatorio").validate(value).error;
      case "telefono":
        return validators.phone("Ingresa un teléfono válido").validate(value).error;
      case "email":
        return value ? validators.email("Correo electrónico inválido").validate(value).error : undefined;
      case "fecha_nacimiento":
        return value ? validators.pastOrPresentDate("La fecha de nacimiento no puede ser futura").validate(value).error : undefined;
      default:
        return undefined;
    }
  }

  // Validate all form fields
  function validateForm(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    let isValid = true;

    for (const key of Object.keys(form) as Array<keyof FormState>) {
      const error = validateField(key, form[key]);
      if (error) {
        errors[key] = error;
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  }

  // Handle field blur
  function handleFieldBlur(name: keyof FormState) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, form[name]);
    setFormErrors((prev) => ({ ...prev, [name]: error }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Mark all fields as touched
    setTouched({
      nombre: true,
      apellido: true,
      dni: true,
      telefono: true,
      email: true,
      fecha_nacimiento: true,
      notas_preferencias: true,
    });

    if (!validateForm()) {
      setError("Por favor, corrige los errores antes de guardar.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim() || null,
      telefono: form.telefono.trim(),
      email: form.email.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      notas_preferencias: form.notas_preferencias.trim() || null,
    };

    try {
      if (editandoId) {
        const actualizado = await actualizarCliente(editandoId, payload);
        setClientes((prev) => prev.map((cliente) => (cliente.id === actualizado.id ? actualizado : cliente)));
        setClienteSeleccionadoId(actualizado.id);
      } else {
        const creado = await crearCliente(payload);
        setClientes((prev) => [...prev, creado]);
        setClienteSeleccionadoId(creado.id);
      }
      setError(null);
      setVista("detalle");
      resetFormulario();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente.");
    }
  }

  async function handleDelete(id: string) {
    const confirmar = window.confirm("¿Seguro que quieres eliminar este cliente?");
    if (!confirmar) return;

    try {
      await eliminarCliente(id);
      setClientes((prev) => prev.filter((cliente) => cliente.id !== id));
      if (clienteSeleccionadoId === id) {
        setClienteSeleccionadoId(null);
      }
      if (editandoId === id) {
        resetFormulario();
      }
      setError(null);
      setVista("lista");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el cliente.");
    }
  }

  if (vista === "lista") {
    return (
      <div className="clientes-page">
        <div className="toolbar">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente..."
            disabled={loading || clientes.length === 0}
          />

          <button className="btn btn-primary" onClick={() => abrirFormulario()}>
            + Nuevo cliente
          </button>
        </div>

        {error && <div className="banner-error">{error}</div>}

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <strong>Cargando clientes...</strong>
          </div>
        ) : clientes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <strong>Todavía no hay clientes registrados</strong>
          </div>
        ) : (
          <table className="tabla-clientes">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Nacimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sin-resultados">
                    Ningún cliente coincide con "{busqueda}".
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="fila-clickable" onClick={() => abrirDetalle(cliente.id)}>
                    <td data-label="Nombre">{cliente.nombre} {cliente.apellido ?? ""}</td>
                    <td data-label="Teléfono">{cliente.telefono}</td>
                    <td data-label="Email">{cliente.email ?? "—"}</td>
                    <td data-label="Nacimiento">{cliente.fecha_nacimiento ?? "—"}</td>
                    <td data-label="Acciones">
                      <div className="acciones-cell" onClick={(event) => event.stopPropagation()}>
                        <button className="btn btn-ghost small" onClick={() => abrirFormulario(cliente.id)}>
                          Editar
                        </button>
                        <button className="btn btn-danger small" onClick={() => void handleDelete(cliente.id)}>
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

  if (vista === "detalle" && clienteDetalle) {
    return (
      <div className="clientes-page">
        <span className="back-link" onClick={() => setVista("lista")}>
          ← Volver a clientes
        </span>

        <h2 className="detalle-titulo">{clienteDetalle.nombre} {clienteDetalle.apellido ?? ""}</h2>
        <p className="sub">Cliente registrado</p>

        <div className="detalle-grid">
          <div className="detalle-card">
            <div className="info-row">
              <span>Teléfono</span>
              <span>{clienteDetalle.telefono}</span>
            </div>
            <div className="info-row">
              <span>Email</span>
              <span>{clienteDetalle.email ?? "—"}</span>
            </div>
            <div className="info-row">
              <span>Fecha de nacimiento</span>
              <span>{clienteDetalle.fecha_nacimiento ?? "—"}</span>
            </div>
            <div className="info-row">
              <span>Notas / preferencias</span>
              <span>{clienteDetalle.notas_preferencias ?? "—"}</span>
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => abrirFormulario(clienteDetalle.id)}>
                Editar
              </button>
              <button className="btn btn-danger" onClick={() => void handleDelete(clienteDetalle.id)}>
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
      <div className="clientes-page">
        <span
          className="back-link"
          onClick={() => {
            resetFormulario();
            setVista(clienteSeleccionadoId ? "detalle" : "lista");
          }}
        >
          ← Cancelar
        </span>

        <form className="cliente-form" onSubmit={handleSubmit}>
          <h2>{editandoId ? "Editar cliente" : "Nuevo cliente"}</h2>

          {error && <div className="banner-error">{error}</div>}

          <label className={touched.nombre && formErrors.nombre ? "has-error" : ""}>
            <span>Nombre *</span>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              onBlur={() => handleFieldBlur("nombre")}
              placeholder="Ingresa el nombre"
            />
            {touched.nombre && formErrors.nombre && <span className="field-error">{formErrors.nombre}</span>}
          </label>

          <label>
            <span>Apellido *</span>
            <input
              type="text"
              value={form.apellido}
              onChange={(e) => setForm((prev) => ({ ...prev, apellido: e.target.value }))}
              onBlur={() => handleFieldBlur("apellido")}
              placeholder="Ingresa el apellido"
            />
            {touched.apellido && formErrors.apellido && <span className="field-error">{formErrors.apellido}</span>}
          </label>

          <label>
            <span>DNI</span>
            <input
              type="text"
              value={form.dni}
              onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value }))}
              maxLength={20}
              placeholder="Documento de identidad"
            />
          </label>

          <label className={touched.telefono && formErrors.telefono ? "has-error" : ""}>
            <span>Teléfono</span>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
              onBlur={() => handleFieldBlur("telefono")}
              placeholder="Ej. 55 1234 5678"
            />
            {touched.telefono && formErrors.telefono && <span className="field-error">{formErrors.telefono}</span>}
          </label>

          <label className={touched.email && formErrors.email ? "has-error" : ""}>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              onBlur={() => handleFieldBlur("email")}
              placeholder="correo@ejemplo.com"
            />
            {touched.email && formErrors.email && <span className="field-error">{formErrors.email}</span>}
          </label>

          <label className={touched.fecha_nacimiento && formErrors.fecha_nacimiento ? "has-error" : ""}>
            <span>Fecha de nacimiento</span>
            <input
              type="date"
              value={form.fecha_nacimiento}
              onChange={(e) => setForm((prev) => ({ ...prev, fecha_nacimiento: e.target.value }))}
              onBlur={() => handleFieldBlur("fecha_nacimiento")}
            />
            {touched.fecha_nacimiento && formErrors.fecha_nacimiento && <span className="field-error">{formErrors.fecha_nacimiento}</span>}
          </label>

          <label>
            <span>Notas y preferencias</span>
            <textarea
              rows={4}
              value={form.notas_preferencias}
              onChange={(e) => setForm((prev) => ({ ...prev, notas_preferencias: e.target.value }))}
              placeholder="Notas sobre preferencias del cliente..."
            />
          </label>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setVista(clienteSeleccionadoId ? "detalle" : "lista")}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editandoId ? "Guardar cambios" : "Guardar cliente"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
