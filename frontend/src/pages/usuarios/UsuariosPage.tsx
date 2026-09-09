import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  crearUsuario,
  eliminarUsuario,
  obtenerUsuarios,
  actualizarUsuario,
} from "./usuariosService";
import type { RolUsuario, Usuario } from "./types";
import "./usuarios.css";

interface FormState {
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

const formVacio: FormState = {
  nombre: "",
  apellido: "",
  email: "",
  rol: "empleado",
  activo: true,
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVacio);

  useEffect(() => {
    void cargarUsuarios();
  }, []);

  async function cargarUsuarios() {
    try {
      setLoading(true);
      const data = await obtenerUsuarios();
      setUsuarios(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;

    return usuarios.filter((usuario) => {
      const texto = `${usuario.nombre} ${usuario.apellido} ${usuario.email} ${usuario.rol}`.toLowerCase();
      return texto.includes(q);
    });
  }, [usuarios, busqueda]);

  function resetFormulario() {
    setForm(formVacio);
    setEditandoId(null);
    setError(null);
  }

  function abrirEdicion(usuario: Usuario) {
    setEditandoId(usuario.id);
    setForm({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo,
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim()) {
      setError("Completa nombre, apellido y email.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
      rol: form.rol,
      activo: form.activo,
    };

    try {
      if (editandoId) {
        const actualizado = await actualizarUsuario(editandoId, payload);
        setUsuarios((prev) => prev.map((usuario) => (usuario.id === actualizado.id ? actualizado : usuario)));
      } else {
        const creado = await crearUsuario(payload);
        setUsuarios((prev) => [...prev, creado]);
      }
      resetFormulario();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el usuario.");
    }
  }

  async function handleDelete(id: string) {
    const confirmar = window.confirm("¿Seguro que quieres eliminar este usuario?");
    if (!confirmar) return;

    try {
      await eliminarUsuario(id);
      setUsuarios((prev) => prev.filter((usuario) => usuario.id !== id));
      if (editandoId === id) {
        resetFormulario();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el usuario.");
    }
  }

  return (
    <div className="usuarios-page">
      <div className="toolbar">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar usuario..."
          disabled={loading || usuarios.length === 0}
        />

        <button className="btn btn-primary" onClick={resetFormulario}>
          + Nuevo usuario
        </button>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <strong>Cargando usuarios...</strong>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <strong>Todavía no hay usuarios registrados</strong>
        </div>
      ) : (
        <div className="usuarios-layout">
          <div className="panel-table">
            <table className="tabla-usuarios">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="sin-resultados">
                      Ningún usuario coincide con "{busqueda}".
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((usuario) => (
                    <tr key={usuario.id}>
                      <td data-label="Nombre">{usuario.nombre} {usuario.apellido}</td>
                      <td data-label="Rol">
                        <span className={`tag ${usuario.rol}`}>{usuario.rol}</span>
                      </td>
                      <td data-label="Email">{usuario.email}</td>
                      <td data-label="Estado">
                        <span className={`tag ${usuario.activo ? "activo" : "inactivo"}`}>
                          {usuario.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td data-label="Acciones">
                        <div className="acciones-cell">
                          <button className="btn btn-ghost small" onClick={() => abrirEdicion(usuario)}>
                            Editar
                          </button>
                          <button className="btn btn-danger small" onClick={() => void handleDelete(usuario.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form className="usuario-form" onSubmit={handleSubmit}>
            <h2>{editandoId ? "Editar usuario" : "Nuevo usuario"}</h2>

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
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>

            <label>
              Rol
              <select
                value={form.rol}
                onChange={(e) => setForm((prev) => ({ ...prev, rol: e.target.value as RolUsuario }))}
              >
                <option value="admin">Admin</option>
                <option value="empleado">Empleado</option>
                <option value="recepcionista">Recepcionista</option>
              </select>
            </label>

            <label>
              Estado
              <select
                value={String(form.activo)}
                onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.value === "true" }))}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={resetFormulario}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                {editandoId ? "Guardar cambios" : "Guardar usuario"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
