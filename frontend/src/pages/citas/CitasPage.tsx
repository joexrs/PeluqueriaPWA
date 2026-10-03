import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Calendar, Views, dateFnsLocalizer } from "react-big-calendar";
import type { View } from "react-big-calendar";
import { addDays, format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { obtenerClientes, type ClienteRow } from "../clientes/clientesService";
import { obtenerProductos } from "../productos/productosService";
import type { ProductoConLotes } from "../productos/types";
import { obtenerServicios, type ServicioRow } from "../servicios/serviciosService";
import { obtenerUsuarios, type UsuarioRow } from "../usuarios/usuariosService";
import { crearVenta } from "../ventas/ventasService";
import { actualizarCita, crearCita, obtenerCitaPorId, obtenerCitasPorFiltro } from "./citasService";
import type { CitaAgenda, CitaConDetalle, CategoriaCita, Especialista } from "./types";
import { validateTimeRange } from "../../lib/validators";

const STAFF_OPTIONS: Especialista[] = ["Todos", "Elena", "Carlos", "Dra. Soto"];
const SERVICE_OPTIONS: CategoriaCita[] = ["hair", "nails", "skin"];

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { es },
  defaultLocale: es,
});

function parseTimeRange(range: string) {
  const [startText, endText] = range.split(" - ");

  const parseTime = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return { hour, minute };
  };

  const start = parseTime(startText.trim());
  const end = parseTime(endText.trim());

  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

export default function CitasPage() {
  const [citas, setCitas] = useState<CitaAgenda[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [trabajadores, setTrabajadores] = useState<UsuarioRow[]>([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState<ServicioRow[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<ProductoConLotes[]>([]);
  const [selectedCita, setSelectedCita] = useState<CitaConDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2023, 9, 25));
  const [view, setView] = useState<View>(Views.WEEK);
  const [selectedStaff, setSelectedStaff] = useState<Especialista>("Todos");
  const [selectedServices, setSelectedServices] = useState<CategoriaCita[]>(["hair", "nails", "skin"]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [extraServicioId, setExtraServicioId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidadProducto, setCantidadProducto] = useState(1);
  const [formulario, setFormulario] = useState({
    clienteId: "",
    trabajadorId: "",
    fecha: format(new Date(), "yyyy-MM-dd"),
    horaInicio: "09:00",
    horaFin: "10:00",
    servicioId: "",
  });

  // Form validation state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const selectedDay = selectedDate.getDate();

  useEffect(() => {
    let cancelled = false;

    async function cargarCitas() {
      try {
        setLoading(true);
        const [data, clientesData, serviciosData, usuariosData, productosData] = await Promise.all([
          obtenerCitasPorFiltro({
            day: selectedDay,
            staff: selectedStaff,
            services: selectedServices,
          }),
          obtenerClientes(),
          obtenerServicios(),
          obtenerUsuarios(true),
          obtenerProductos({ soloActivos: true }),
        ]);

        if (!cancelled) {
          setCitas(data);
          setClientes(clientesData);
          setServiciosCatalogo(serviciosData);
          setTrabajadores(usuariosData);
          setProductosCatalogo(productosData);

          setFormulario((actual) => ({
            ...actual,
            clienteId: actual.clienteId || clientesData[0]?.id || "",
            trabajadorId: actual.trabajadorId || usuariosData[0]?.id || "",
            servicioId: actual.servicioId || serviciosData[0]?.id || "",
          }));
          setProductoId((prev) => prev || productosData[0]?.id || "");
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las citas.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void cargarCitas();

    return () => {
      cancelled = true;
    };
  }, [selectedDay, selectedStaff, selectedServices]);

  const events = useMemo(
    () =>
      citas.map((cita) => {
        const baseDate = new Date(2023, 9, cita.day);
        const { startHour, startMinute, endHour, endMinute } = parseTimeRange(cita.time);

        const start = new Date(baseDate);
        start.setHours(startHour, startMinute, 0, 0);

        const end = new Date(baseDate);
        end.setHours(endHour, endMinute, 0, 0);

        return {
          id: cita.id,
          title: `${cita.title} — ${cita.client}`,
          start,
          end,
          category: cita.category,
          staff: cita.staff,
          client: cita.client,
        };
      }),
    [citas],
  );

  // Validate the form fields
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    // Validate cliente
    if (!formulario.clienteId) {
      errors.clienteId = "Selecciona un cliente";
    }

    // Validate fecha
    if (!formulario.fecha) {
      errors.fecha = "La fecha es obligatoria";
    }

    // Validate time range
    if (!formulario.horaInicio || !formulario.horaFin) {
      errors.horaInicio = "El horario es obligatorio";
    } else {
      const timeValidation = validateTimeRange(formulario.horaInicio, formulario.horaFin);
      if (!timeValidation.valid && timeValidation.error) {
        errors.horaFin = timeValidation.error;
      }
    }

    // Validate servicio
    if (!formulario.servicioId) {
      errors.servicioId = "Selecciona un servicio";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Handle field blur for validation
  function handleFieldBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateForm();
  }

  async function handleCrearCita(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Mark all fields as touched
    setTouched({
      clienteId: true,
      fecha: true,
      horaInicio: true,
      horaFin: true,
      servicioId: true,
    });

    if (!validateForm()) {
      setError("Por favor, corrige los errores antes de guardar.");
      return;
    }

    const servicioSeleccionado = serviciosCatalogo.find((servicio) => servicio.id === formulario.servicioId);
    if (!servicioSeleccionado) return;

    try {
      setCreating(true);
      setError(null);

      await crearCita({
        cliente_id: formulario.clienteId,
        trabajador_id: formulario.trabajadorId || null,
        fecha: formulario.fecha,
        hora_inicio: formulario.horaInicio,
        hora_fin: formulario.horaFin,
        estado: "PENDIENTE",
        origen: "PWA_RECEPCION",
        notas: null,
        servicios: [
          {
            servicio_id: servicioSeleccionado.id,
            precio_aplicado: Number(servicioSeleccionado.precio_base ?? 0),
            duracion_minutos: Number(servicioSeleccionado.duracion_minutos ?? 0),
          },
        ],
      });

      setMostrarFormulario(false);
      setFormulario({
        clienteId: clientes[0]?.id ?? "",
        trabajadorId: trabajadores[0]?.id ?? "",
        fecha: format(new Date(), "yyyy-MM-dd"),
        horaInicio: "09:00",
        horaFin: "10:00",
        servicioId: serviciosCatalogo[0]?.id ?? "",
      });
      setSelectedDate(new Date(formulario.fecha));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cita.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSelectEvent(event: { id: string }) {
    try {
      const cita = await obtenerCitaPorId(event.id);
      setSelectedCita(cita);
      setExtraServicioId("");
      if (!productoId && productosCatalogo[0]) {
        setProductoId(productosCatalogo[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la cita.");
    }
  }

  async function handleAgregarServicioExtra() {
    if (!selectedCita || !extraServicioId) return;

    const servicioSeleccionado = serviciosCatalogo.find((servicio) => servicio.id === extraServicioId);
    if (!servicioSeleccionado) return;

    try {
      const serviciosActuales = selectedCita.servicios.map((servicio) => ({
        servicio_id: servicio.servicio_id,
        precio_aplicado: servicio.precio_aplicado,
        duracion_minutos: servicio.duracion_minutos,
      }));

      const nuevaCita = await actualizarCita(selectedCita.id, {
        servicios: [
          ...serviciosActuales,
          {
            servicio_id: servicioSeleccionado.id,
            precio_aplicado: Number(servicioSeleccionado.precio_base ?? 0),
            duracion_minutos: Number(servicioSeleccionado.duracion_minutos ?? 0),
          },
        ],
      });

      setSelectedCita(nuevaCita);
      setExtraServicioId("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir el servicio adicional.");
    }
  }

  async function handleAgregarProductoVenta() {
    if (!selectedCita || !productoId) return;

    const productoSeleccionado = productosCatalogo.find((producto) => producto.id === productoId);
    if (!productoSeleccionado) return;

    try {
      const totalPrecio = Number(productoSeleccionado.precio_venta_publico ?? 0) * cantidadProducto;

      await crearVenta({
        cliente_id: selectedCita.cliente_id,
        cita_id: selectedCita.id,
        vendedor_usuario_id: selectedCita.trabajador_id ?? null,
        servicios: selectedCita.servicios.map((servicio) => ({
          servicio_id: servicio.servicio_id,
          trabajador_id: selectedCita.trabajador_id ?? null,
          precio_unitario: servicio.precio_aplicado,
        })),
        productos: [
          {
            producto_id: productoSeleccionado.id,
            lote_id: productoSeleccionado.lotes[0]?.id ?? null,
            cantidad: cantidadProducto,
            precio_unitario: Number(productoSeleccionado.precio_venta_publico ?? 0),
          },
        ],
        pagos: [
          {
            metodo_pago: "EFECTIVO",
            monto: totalPrecio,
            numero_operacion: null,
          },
        ],
      });

      setProductoId(productosCatalogo[0]?.id ?? "");
      setCantidadProducto(1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir el producto a la venta.");
    }
  }

  function toggleService(service: CategoriaCita) {
    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service],
    );
  }

  function eventStyleGetter(event: { category: CategoriaCita }) {
    const categoryStyles: Record<CategoriaCita, { backgroundColor: string; borderColor: string; color: string }> = {
      hair: {
        backgroundColor: "#7a2e45",
        borderColor: "#7a2e45",
        color: "#fff",
      },
      nails: {
        backgroundColor: "#d9b642",
        borderColor: "#d9b642",
        color: "#fff",
      },
      skin: {
        backgroundColor: "#2e7a5d",
        borderColor: "#2e7a5d",
        color: "#fff",
      },
    };

    const palette = categoryStyles[event.category];

    return {
      style: {
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        borderRadius: "10px",
        color: palette.color,
        border: "none",
        boxShadow: "0 10px 18px rgba(36, 20, 25, 0.08)",
      },
    };
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏳</div>
        <strong>Cargando agenda...</strong>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <strong>{error}</strong>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="calendar-shell">
        <div className="calendar-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Agenda</h3>
            <button type="button" className="btn btn-primary" onClick={() => setMostrarFormulario((actual) => !actual)}>
              {mostrarFormulario ? "Cancelar" : "+ Nueva cita"}
            </button>
          </div>

          {mostrarFormulario && (
            <form onSubmit={handleCrearCita} className="cita-form">
              <div className="form-grid">
                <label className={formErrors.clienteId && touched.clienteId ? "has-error" : ""}>
                  <span>Cliente *</span>
                  <select 
                    value={formulario.clienteId} 
                    onChange={(event) => setFormulario((actual) => ({ ...actual, clienteId: event.target.value }))}
                    onBlur={() => handleFieldBlur("clienteId")}
                  >
                    <option value="">Selecciona cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre} {cliente.apellido ?? ""}
                      </option>
                    ))}
                  </select>
                  {touched.clienteId && formErrors.clienteId && <span className="field-error">{formErrors.clienteId}</span>}
                </label>

                <label>
                  <span>Trabajador</span>
                  <select value={formulario.trabajadorId} onChange={(event) => setFormulario((actual) => ({ ...actual, trabajadorId: event.target.value }))}>
                    <option value="">Sin asignar</option>
                    {trabajadores.map((trabajador) => (
                      <option key={trabajador.id} value={trabajador.id}>
                        {trabajador.nombre} {trabajador.apellido}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={formErrors.fecha && touched.fecha ? "has-error" : ""}>
                  <span>Fecha *</span>
                  <input 
                    type="date" 
                    value={formulario.fecha} 
                    onChange={(event) => setFormulario((actual) => ({ ...actual, fecha: event.target.value }))}
                    onBlur={() => handleFieldBlur("fecha")}
                  />
                  {touched.fecha && formErrors.fecha && <span className="field-error">{formErrors.fecha}</span>}
                </label>

                <label className={formErrors.horaInicio && touched.horaInicio ? "has-error" : ""}>
                  <span>Hora inicio *</span>
                  <input 
                    type="time" 
                    value={formulario.horaInicio} 
                    onChange={(event) => setFormulario((actual) => ({ ...actual, horaInicio: event.target.value }))}
                    onBlur={() => handleFieldBlur("horaInicio")}
                  />
                  {touched.horaInicio && formErrors.horaInicio && <span className="field-error">{formErrors.horaInicio}</span>}
                </label>

                <label className={formErrors.horaFin && touched.horaFin ? "has-error" : ""}>
                  <span>Hora fin *</span>
                  <input 
                    type="time" 
                    value={formulario.horaFin} 
                    onChange={(event) => setFormulario((actual) => ({ ...actual, horaFin: event.target.value }))}
                    onBlur={() => handleFieldBlur("horaFin")}
                  />
                  {touched.horaFin && formErrors.horaFin && <span className="field-error">{formErrors.horaFin}</span>}
                </label>

                <label className={formErrors.servicioId && touched.servicioId ? "has-error" : ""}>
                  <span>Servicio *</span>
                  <select 
                    value={formulario.servicioId} 
                    onChange={(event) => setFormulario((actual) => ({ ...actual, servicioId: event.target.value }))}
                    onBlur={() => handleFieldBlur("servicioId")}
                  >
                    <option value="">Selecciona servicio</option>
                    {serviciosCatalogo.map((servicio) => (
                      <option key={servicio.id} value={servicio.id}>
                        {servicio.nombre}
                      </option>
                    ))}
                  </select>
                  {touched.servicioId && formErrors.servicioId && <span className="field-error">{formErrors.servicioId}</span>}
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Guardando..." : "Guardar cita"}
                </button>
              </div>
            </form>
          )}

          <Calendar
            localizer={localizer}
            culture="es"
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 700 }}
            date={selectedDate}
            view={view}
            views={['month', 'week', 'day']}
            onNavigate={(nextDate: Date) => setSelectedDate(nextDate)}
            onView={(nextView: View) => setView(nextView)}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            messages={{
              next: "Siguiente",
              previous: "Anterior",
              today: "Hoy",
              month: "Mes",
              week: "Semana",
              day: "Día",
              agenda: "Agenda",
            }}
          />

          {selectedCita && (
            <div style={{ marginTop: 18, display: "grid", gap: 16, background: "#f5f5f5", padding: 16, borderRadius: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Cita seleccionada</h3>
                <p style={{ margin: "6px 0 0" }}>
                  {selectedCita.cliente ? `${selectedCita.cliente.nombre} ${selectedCita.cliente.apellido ?? ""}`.trim() : "Cliente"} · {selectedCita.fecha} · {selectedCita.hora_inicio.slice(0, 5)} - {selectedCita.hora_fin.slice(0, 5)}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Agregar servicio extra</span>
                    <select value={extraServicioId} onChange={(event) => setExtraServicioId(event.target.value)}>
                      <option value="">Selecciona servicio</option>
                      {serviciosCatalogo.map((servicio) => (
                        <option key={servicio.id} value={servicio.id}>
                          {servicio.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn btn-primary" onClick={() => void handleAgregarServicioExtra()} disabled={!extraServicioId}>
                    Añadir servicio
                  </button>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Producto para usar</span>
                    <select value={productoId} onChange={(event) => setProductoId(event.target.value)}>
                      <option value="">Selecciona producto</option>
                      {productosCatalogo.map((producto) => (
                        <option key={producto.id} value={producto.id}>
                          {producto.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Cantidad</span>
                    <input type="number" min={1} value={cantidadProducto} onChange={(event) => setCantidadProducto(Number(event.target.value || 1))} />
                  </label>
                  <button type="button" className="btn btn-primary" onClick={() => void handleAgregarProductoVenta()} disabled={!productoId}>
                    Añadir producto a venta
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="calendar-filters">
          <h3>Filtros</h3>

          <div className="filter-group">
            <h4>Especialistas</h4>
            {STAFF_OPTIONS.map((staff) => (
              <label key={staff} className={selectedStaff === staff ? "filter-option active" : "filter-option"}>
                <input
                  type="radio"
                  name="staff"
                  checked={selectedStaff === staff}
                  onChange={() => setSelectedStaff(staff)}
                />
                {staff === "Todos" ? "Todos" : `${staff} (${staff === "Elena" ? "Cabello" : staff === "Carlos" ? "Uñas" : "Piel"})`}
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h4>Servicios</h4>
            <div className="chip-list">
              {SERVICE_OPTIONS.map((service) => (
                <button
                  key={service}
                  type="button"
                  className={selectedServices.includes(service) ? `chip ${service} active` : `chip ${service}`}
                  onClick={() => toggleService(service)}
                >
                  {service === "hair" ? "Cabello" : service === "nails" ? "Uñas" : "Piel"}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group filter-group--quick-actions">
            <h4>Acciones</h4>
            <button type="button" className="btn btn-primary" onClick={() => setSelectedDate(new Date(2023, 9, 25))}>
              Ver fecha actual
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
              Siguiente semana
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
