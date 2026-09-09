import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  crearCliente,
  eliminarCliente,
  obtenerClientes,
  actualizarCliente,
} from "./clientesService";
import type { Cliente } from "./types";
import "./clientes.css";

type Vista = "lista" | "detalle" | "form";

interface FormState {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
}

const formVacio: FormState = {
  nombre: "",
  apellido: "",
  telefono: "",
  email: "",
  fechaNacimiento: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio);

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
      const texto = `${cliente.nombre} ${cliente.apellido} ${cliente.telefono} ${cliente.email}`.toLowerCase();
      return texto.includes(q);
    });
  }, [clientes, busqueda]);

  const clienteDetalle = clientes.find((cliente) => cliente.id === clienteSeleccionadoId) ?? null;

  function resetFormulario() {
    setForm(formVacio);
    setEditandoId(null);
    setError(null);
  }

  function abrirDetalle(id: string) {
    setClienteSeleccionadoId(id);
    setVista("detalle");
    setError(null);
  }

  function abrirFormulario(id?: string) {
    if (id) {
      const cliente = clientes.find((item) => item.id === id);
      if (cliente) {
        setEditandoId(cliente.id);
        setForm({
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          telefono: cliente.telefono,
          email: cliente.email,
          fechaNacimiento: cliente.fechaNacimiento,
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

    const campos = Object.values(form).map((value) => value.trim());
    if (campos.some((value) => !value)) {
      setError("Completa todos los campos antes de guardar.");
      return;
    }

    try {
      if (editandoId) {
        const actualizado = await actualizarCliente(editandoId, form);
        setClientes((prev) => prev.map((cliente) => (cliente.id === actualizado.id ? actualizado : cliente)));
        setClienteSeleccionadoId(actualizado.id);
      } else {
        const creado = await crearCliente(form);
        setClientes((prev) => [...prev, creado]);
        setClienteSeleccionadoId(creado.id);
      }
      setError(null);
      setVista("detalle");
      setForm(formVacio);
      setEditandoId(null);
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
                    <td data-label="Nombre">{cliente.nombre} {cliente.apellido}</td>
                    <td data-label="Teléfono">{cliente.telefono}</td>
                    <td data-label="Email">{cliente.email}</td>
                    <td data-label="Nacimiento">{cliente.fechaNacimiento}</td>
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

        <h2 className="detalle-titulo">{clienteDetalle.nombre} {clienteDetalle.apellido}</h2>
        <p className="sub">Cliente registrado</p>

        <div className="detalle-grid">
          <div className="detalle-card">
            <div className="info-row">
              <span>Teléfono</span>
              <span>{clienteDetalle.telefono}</span>
            </div>
            <div className="info-row">
              <span>Email</span>
              <span>{clienteDetalle.email}</span>
            </div>
            <div className="info-row">
              <span>Fecha de nacimiento</span>
              <span>{clienteDetalle.fechaNacimiento}</span>
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
        <span className="back-link" onClick={() => setVista(clienteSeleccionadoId ? "detalle" : "lista")}>
          ← Cancelar
        </span>

        <form className="cliente-form" onSubmit={handleSubmit}>
          <h2>{editandoId ? "Editar cliente" : "Nuevo cliente"}</h2>

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
            Apellido
            <input
              type="text"
              value={form.apellido}
              onChange={(e) => setForm((prev) => ({ ...prev, apellido: e.target.value }))}
            />
          </label>

          <label>
            Teléfono
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>

          <label>
            Fecha de nacimiento
            <input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => setForm((prev) => ({ ...prev, fechaNacimiento: e.target.value }))}
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
