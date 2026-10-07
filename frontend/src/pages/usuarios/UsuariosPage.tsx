import { useEffect, useMemo, useState, type FormEvent } from "react";
import { obtenerServicios, type ServicioRow } from "../servicios/serviciosService";
import {
  crearUsuario,
  eliminarUsuario,
  obtenerUsuarios,
  actualizarUsuario,
  obtenerServiciosTrabajador,
  guardarServiciosTrabajador,
  type RolUsuario,
  type UsuarioRow,
} from "./usuariosService";
import "./usuarios.css";

interface FormState {
  nombre: string;
  apellido: string;
  email: string;
  usuario: string;
  password: string;
  dni: string;
  telefono: string;
  rol: RolUsuario;
  color_agenda: string;
  comision_porcentaje: string;
  activo: boolean;
  servicios_ids: string[];
}

const formVacio: FormState = {
  nombre: "",
  apellido: "",
  email: "",
  usuario: "",
  password: "",
  dni: "",
  telefono: "",
  rol: "trabajador",
  color_agenda: "#3B82F6",
  comision_porcentaje: "0",
  activo: true,
  servicios_ids: [],
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio);
  const [servicios, setServicios] = useState<ServicioRow[]>([]);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      try {
        setLoading(true);
        const [data, serviciosData] = await Promise.all([obtenerUsuarios(), obtenerServicios()]);
        if (!cancelado) {
          setUsuarios(data);
          setServicios(serviciosData);
          setError(null);
        }
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.");
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    };

    void cargar();

    return () => {
      cancelado = true;
    };
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;

    return usuarios.filter((usuario) => {
      const texto = `${usuario.nombre} ${usuario.apellido} ${usuario.email} ${usuario.rol} ${usuario.dni ?? ""} ${usuario.telefono ?? ""}`.toLowerCase();
      return texto.includes(q);
    });
  }, [usuarios, busqueda]);

  function resetFormulario() {
    setForm(formVacio);
    setEditandoId(null);
    setFormVisible(false);
    setError(null);
  }

  function abrirCreacion() {
    setEditandoId(null);
    setForm(formVacio);
    setFormVisible(true);
    setError(null);
  }

  async function abrirEdicion(usuario: UsuarioRow) {
    setEditandoId(usuario.id);
    setFormVisible(true);
    setForm({
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      usuario: String(usuario.Usuario ?? ""),
      password: "",
      dni: usuario.dni ?? "",
      telefono: usuario.telefono ?? "",
      rol: usuario.rol,
      color_agenda: usuario.color_agenda ?? "#3B82F6",
      comision_porcentaje: String(usuario.comision_porcentaje ?? 0),
      activo: usuario.activo,
      servicios_ids: [],
    });
    setError(null);
    if (usuario.rol === "trabajador") {
      try {
        const ids = await obtenerServiciosTrabajador(usuario.id);
        setForm((actual) => ({ ...actual, servicios_ids: ids }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar los servicios del trabajador.");
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim()) {
      setError("Completa nombre, apellido y email.");
      return;
    }

    if (!editandoId && (!form.usuario.trim() || !form.password)) {
      setError("Completa el nombre de usuario y la contraseña.");
      return;
    }

    const comision = Number(form.comision_porcentaje);
    if (!Number.isFinite(comision) || comision < 0 || comision > 100) {
      setError("La comisión debe ser un número entre 0 y 100.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
      usuario: form.usuario.trim(),
      password: form.password,
      dni: form.dni.trim() || null,
      telefono: form.telefono.trim() || null,
      rol: form.rol,
      color_agenda: form.color_agenda || "#3B82F6",
      comision_porcentaje: comision,
      activo: form.activo,
      servicios_ids: form.rol === "trabajador" ? form.servicios_ids : [],
    };

    try {
      setGuardando(true);
      if (editandoId) {
        const actualizado = await actualizarUsuario(editandoId, payload);
        await guardarServiciosTrabajador(editandoId, payload.servicios_ids);
        setUsuarios((prev) => prev.map((usuario) => (usuario.id === actualizado.id ? actualizado : usuario)));
      } else {
        const creado = await crearUsuario(payload);
        await guardarServiciosTrabajador(creado.id, payload.servicios_ids);
        setUsuarios((prev) => [...prev, creado]);
      }
      resetFormulario();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el usuario.");
    } finally {
      setGuardando(false);
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

        <span className="usuario-auth-notice">
          Las cuentas nuevas se crean con los roles recepcionista o trabajador.
        </span>
        <button type="button" className="btn btn-primary" onClick={abrirCreacion} disabled={loading}>
          Nuevo usuario
        </button>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <strong>Cargando usuarios...</strong>
        </div>
      ) : usuarios.length === 0 && !formVisible ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <strong>Todavía no hay usuarios registrados</strong>
        </div>
      ) : (
        <div className="usuarios-layout">
          {usuarios.length > 0 ? (
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
          ) : (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <strong>Todavía no hay usuarios registrados</strong>
            </div>
          )}

          {formVisible && <form className="usuario-form" onSubmit={handleSubmit}>
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
                readOnly={Boolean(editandoId)}
                required
                aria-describedby="usuario-email-ayuda"
              />
              <small id="usuario-email-ayuda">
                {editandoId ? "El correo de acceso se administra desde Supabase Auth." : "Se usará para iniciar sesión."}
              </small>
            </label>

            {!editandoId && (
              <>
                <label>
                  Usuario
                  <input
                    type="text"
                    value={form.usuario}
                    onChange={(e) => setForm((prev) => ({ ...prev, usuario: e.target.value }))}
                    autoComplete="username"
                    required
                  />
                </label>

                <label>
                  Contraseña
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </>
            )}

            <label>
              DNI
              <input
                type="text"
                value={form.dni}
                onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value }))}
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
              Rol
              <select
                value={form.rol}
                onChange={(e) => setForm((prev) => ({ ...prev, rol: e.target.value as RolUsuario }))}
              >
                {editandoId && form.rol !== "recepcionista" && form.rol !== "trabajador" && (
                  <option value={form.rol}>{form.rol}</option>
                )}
                <option value="recepcionista">Recepcionista</option>
                <option value="trabajador">Trabajador</option>
              </select>
            </label>

            {form.rol === "trabajador" && (
              <fieldset className="usuario-servicios">
                <legend>Servicios que puede realizar</legend>
                {servicios.length === 0 ? <small>No hay servicios activos disponibles.</small> : servicios.map((servicio) => {
                  const id = String(servicio.id ?? servicio.ID);
                  return (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={form.servicios_ids.includes(id)}
                        onChange={(event) => setForm((prev) => ({
                          ...prev,
                          servicios_ids: event.target.checked
                            ? [...prev.servicios_ids, id]
                            : prev.servicios_ids.filter((actual) => actual !== id),
                        }))}
                      />
                      {servicio.nombre}
                    </label>
                  );
                })}
              </fieldset>
            )}

            <label>
              Color de agenda
              <input
                type="color"
                value={form.color_agenda}
                onChange={(e) => setForm((prev) => ({ ...prev, color_agenda: e.target.value }))}
              />
            </label>

            <label>
              Comisión (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.comision_porcentaje}
                onChange={(e) => setForm((prev) => ({ ...prev, comision_porcentaje: e.target.value }))}
              />
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
              <button type="button" className="btn btn-ghost" onClick={resetFormulario} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </form>}
        </div>
      )}
    </div>
  );
}
