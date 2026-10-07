/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type TouchEvent } from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import "./CitasPage.css";
import { obtenerClientes, type ClienteRow } from "../clientes/clientesService";
import { obtenerProductos } from "../productos/productosService";
import type { ProductoConLotes } from "../productos/types";
import { obtenerServicios, type ServicioRow } from "../servicios/serviciosService";
import { obtenerUsuarios, type UsuarioRow } from "../usuarios/usuariosService";
import { obtenerIdsTrabajadoresPorServicio } from "../trabajadores/trabajadoresService";
import { agregarProductoVenta, crearVenta, obtenerVentaPorCita } from "../ventas/ventasService";
import { actualizarCita, cambiarEstadoCita, crearCita, obtenerCitas } from "./citasService";
import type { CitaConDetalle, CrearCitaPayload, EstadoCita } from "./types";
import { validateTimeRange } from "../../lib/validators";
import { useAuth } from "../../context/AuthContext";

// ─── Constantes y helpers ────────────────────────────────────────────────────

const WEEK = { weekStartsOn: 1, locale: es } as const; // semana lunes → domingo
const ISO = "yyyy-MM-dd";
const HORA_PX = 56; // alto de una hora en la vista semanal
const LETRAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

type Categoria = "hair" | "nails" | "skin";
const CATEGORIAS: Record<Categoria, { label: string; color: string }> = {
  hair: { label: "Cabello", color: "#7a2e45" },
  nails: { label: "Uñas", color: "#d9b642" },
  skin: { label: "Piel", color: "#2e7a5d" },
};
const TODAS_CATEGORIAS = Object.keys(CATEGORIAS) as Categoria[];

/** Misma regla que usaba la agenda anterior: se deduce por el nombre del servicio. */
function categoriaDe(c: CitaConDetalle): Categoria {
  const nombre = c.servicios.map((s) => s.nombre).join(" ").toLowerCase();
  if (/uñas|manicura|pedicura/.test(nombre)) return "nails";
  if (/piel|facial|limpieza/.test(nombre)) return "skin";
  return "hair";
}

const ESTADOS: Record<EstadoCita, { label: string; clase: string }> = {
  PENDIENTE: { label: "Pendiente", clase: "pendiente" },
  CONFIRMADA: { label: "Confirmada", clase: "confirmada" },
  EN_ATENCION: { label: "En atención", clase: "atencion" },
  COMPLETADA: { label: "Completada", clase: "completada" },
  CANCELADA: { label: "Cancelada", clase: "cancelada" },
  NO_SHOW: { label: "No asistió", clase: "noshow" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (hora: string) => hora.slice(0, 5);
const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
};
const sumarMinutos = (hora: string, min: number) => {
  const total = Math.min(aMinutos(hora) + min, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};
const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const soles = (n: number | null | undefined) => `S/ ${Number(n ?? 0).toFixed(2)}`;
const mensajeError = (err: unknown, defecto: string) => (err instanceof Error ? err.message : defecto);

const nombreCliente = (c: CitaConDetalle) =>
  c.cliente ? `${c.cliente.nombre} ${c.cliente.apellido ?? ""}`.trim() : "Cliente";
const tituloCita = (c: CitaConDetalle) => c.servicios.map((s) => s.nombre).join(" + ") || "Sin servicios";
const colorCita = (c: CitaConDetalle) => CATEGORIAS[categoriaDe(c)].color;
const nombreTrabajador = (c: CitaConDetalle) =>
  c.trabajador ? `${c.trabajador.nombre} ${c.trabajador.apellido}`.trim() : "Sin asignar";

function useEsEscritorio() {
  const consulta = "(min-width: 960px)";
  const [es960, setEs960] = useState(() => typeof window !== "undefined" && window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const actualizar = () => setEs960(m.matches);
    actualizar();
    m.addEventListener("change", actualizar);
    return () => m.removeEventListener("change", actualizar);
  }, []);
  return es960;
}

/** Reparte en carriles las citas que se solapan para que no se tapen entre sí. */
function carriles(citas: CitaConDetalle[]) {
  const orden = [...citas].sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio));
  const res = new Map<string, { carril: number; total: number }>();
  let grupo: CitaConDetalle[] = [];
  let finGrupo = -1;
  let finCarril: number[] = [];

  const cerrar = () => {
    const total = finCarril.length;
    grupo.forEach((c) => {
      const dato = res.get(c.id);
      if (dato) dato.total = total;
    });
    grupo = [];
    finCarril = [];
    finGrupo = -1;
  };

  for (const c of orden) {
    const ini = aMinutos(c.hora_inicio);
    const fin = aMinutos(c.hora_fin);
    if (grupo.length && ini >= finGrupo) cerrar();
    let k = finCarril.findIndex((f) => f <= ini);
    if (k === -1) {
      k = finCarril.length;
      finCarril.push(fin);
    } else {
      finCarril[k] = fin;
    }
    res.set(c.id, { carril: k, total: 1 });
    grupo.push(c);
    finGrupo = Math.max(finGrupo, fin);
  }
  cerrar();
  return res;
}

// ─── Piezas de interfaz ──────────────────────────────────────────────────────

function EstadoPill({ estado }: { estado: EstadoCita }) {
  const { label, clase } = ESTADOS[estado];
  return <span className={`ag-pill ag-pill--${clase}`}>{label}</span>;
}

/** Cuadrícula de días con puntos en los días que tienen citas (sirve para semana y mes). */
function Dias({
  dias,
  mes,
  ocultarFuera,
  seleccionado,
  marcados,
  onElegir,
}: {
  dias: Date[];
  mes?: Date;
  ocultarFuera?: boolean;
  seleccionado: Date;
  marcados: Set<string>;
  onElegir: (d: Date) => void;
}) {
  return (
    <div className="ag-dias">
      {LETRAS_SEMANA.map((l, i) => (
        <span key={i} className="ag-dias__letra" aria-hidden="true">
          {l}
        </span>
      ))}
      {dias.map((d) => {
        const fuera = mes !== undefined && !isSameMonth(d, mes);
        if (fuera && ocultarFuera) return <span key={d.toISOString()} className="ag-dia ag-dia--vacio" />;
        const clases = ["ag-dia"];
        if (fuera) clases.push("ag-dia--fuera");
        if (isSameDay(d, new Date())) clases.push("ag-dia--hoy");
        if (isSameDay(d, seleccionado)) clases.push("ag-dia--sel");
        return (
          <button
            key={d.toISOString()}
            type="button"
            className={clases.join(" ")}
            onClick={() => onElegir(d)}
            aria-label={format(d, "EEEE d 'de' MMMM", { locale: es })}
            aria-pressed={isSameDay(d, seleccionado)}
          >
            <span>{d.getDate()}</span>
            {marcados.has(format(d, ISO)) && <i className="ag-dia__punto" />}
          </button>
        );
      })}
    </div>
  );
}

/** Lista de tarjetas agrupadas por día. */
function ListaPorDia({
  grupos,
  seleccionadaId,
  onAbrir,
  vacio,
}: {
  grupos: Array<[string, CitaConDetalle[]]>;
  seleccionadaId?: string;
  onAbrir: (c: CitaConDetalle) => void;
  vacio: string;
}) {
  if (grupos.length === 0) {
    return (
      <div className="ag-vacio">
        <strong>{vacio}</strong>
        <span>Usa “Nueva cita” para registrar una.</span>
      </div>
    );
  }
  return (
    <div className="ag-lista">
      {grupos.map(([fecha, citas]) => {
        const d = parseISO(fecha);
        return (
          <section key={fecha} className="ag-grupo">
            <div className="ag-grupo__fecha">
              <strong>{d.getDate()}</strong>
              <span>{capitalizar(format(d, "EEE", { locale: es }))}.</span>
            </div>
            <div className="ag-grupo__citas">
              {citas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ag-card${c.id === seleccionadaId ? " ag-card--sel" : ""}${
                    c.estado === "CANCELADA" || c.estado === "NO_SHOW" ? " ag-card--apagada" : ""
                  }`}
                  style={{ "--c": colorCita(c) } as CSSProperties}
                  onClick={() => onAbrir(c)}
                >
                  <EstadoPill estado={c.estado} />
                  <strong className="ag-card__titulo">{tituloCita(c)}</strong>
                  <span className="ag-card__hora">
                    {hhmm(c.hora_inicio)} - {hhmm(c.hora_fin)}
                  </span>
                  <span className="ag-card__meta">
                    {nombreCliente(c)} · {nombreTrabajador(c)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Vista semanal con horas (escritorio). */
function SemanaGrid({
  fecha,
  porFecha,
  seleccionadaId,
  onAbrir,
  onDia,
}: {
  fecha: Date;
  porFecha: Map<string, CitaConDetalle[]>;
  seleccionadaId?: string;
  onAbrir: (c: CitaConDetalle) => void;
  onDia: (d: Date) => void;
}) {
  const dias = eachDayOfInterval({ start: startOfWeek(fecha, WEEK), end: endOfWeek(fecha, WEEK) });
  const todas = dias.flatMap((d) => porFecha.get(format(d, ISO)) ?? []);

  const minIni = todas.length ? Math.min(...todas.map((c) => aMinutos(c.hora_inicio))) : 8 * 60;
  const maxFin = todas.length ? Math.max(...todas.map((c) => aMinutos(c.hora_fin))) : 20 * 60;
  const horaIni = Math.max(0, Math.min(8, Math.floor(minIni / 60)));
  const horaFin = Math.min(24, Math.max(20, Math.ceil(maxFin / 60)));
  const horas = Array.from({ length: horaFin - horaIni }, (_, i) => horaIni + i);
  const alto = horas.length * HORA_PX;

  const ahora = new Date();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const lineaAhora = minAhora >= horaIni * 60 && minAhora <= horaFin * 60;

  return (
    <div className="ag-semana" style={{ "--hora-px": `${HORA_PX}px` } as CSSProperties}>
      <div className="ag-semana__cabecera">
        <span />
        {dias.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            className={`ag-semana__dia${isSameDay(d, new Date()) ? " ag-semana__dia--hoy" : ""}${
              isSameDay(d, fecha) ? " ag-semana__dia--sel" : ""
            }`}
            onClick={() => onDia(d)}
          >
            <span>{capitalizar(format(d, "EEE", { locale: es }))}</span>
            <strong>{d.getDate()}</strong>
          </button>
        ))}
      </div>

      <div className="ag-semana__cuerpo">
        <div className="ag-semana__horas" style={{ height: alto }}>
          {horas.map((h) => (
            <span key={h} style={{ top: (h - horaIni) * HORA_PX }}>
              {pad(h)}:00
            </span>
          ))}
        </div>

        {dias.map((d) => {
          const clave = format(d, ISO);
          const citasDia = porFecha.get(clave) ?? [];
          const disposicion = carriles(citasDia);
          return (
            <div key={clave} className="ag-semana__col" style={{ height: alto }}>
              {isSameDay(d, ahora) && lineaAhora && (
                <i className="ag-semana__ahora" style={{ top: ((minAhora - horaIni * 60) / 60) * HORA_PX }} />
              )}
              {citasDia.map((c) => {
                const ini = aMinutos(c.hora_inicio);
                const fin = aMinutos(c.hora_fin);
                const { carril, total } = disposicion.get(c.id) ?? { carril: 0, total: 1 };
                const altoEvento = Math.max(((fin - ini) / 60) * HORA_PX - 2, 24);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`ag-evento${c.id === seleccionadaId ? " ag-evento--sel" : ""}${
                      c.estado === "CANCELADA" || c.estado === "NO_SHOW" ? " ag-evento--apagado" : ""
                    }`}
                    style={
                      {
                        "--c": colorCita(c),
                        top: ((ini - horaIni * 60) / 60) * HORA_PX,
                        height: altoEvento,
                        left: `calc(${(carril / total) * 100}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                      } as CSSProperties
                    }
                    onClick={() => onAbrir(c)}
                    title={`${tituloCita(c)} · ${nombreCliente(c)}`}
                  >
                    <strong>{nombreCliente(c)}</strong>
                    {altoEvento >= 40 && <span>{tituloCita(c)}</span>}
                    {altoEvento >= 56 && (
                      <em>
                        {hhmm(c.hora_inicio)} - {hhmm(c.hora_fin)}
                      </em>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Contenedor: panel lateral en escritorio, hoja desde abajo en celular. */
function Panel({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return (
    <div className="ag-overlay" onClick={onCerrar}>
      <section
        className="ag-panel"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ag-panel__cabecera">
          <h3>{titulo}</h3>
          <button type="button" className="ag-icono" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="ag-panel__cuerpo">{children}</div>
      </section>
    </div>
  );
}

// ─── Filtros: especialistas y servicios ──────────────────────────────────────

function Filtros({
  trabajadores,
  trabajadorId,
  onTrabajador,
  categorias,
  onCategoria,
  mostrarCanceladas,
  onCanceladas,
  soloCategorias,
  servicios,
  servicioId,
  onServicio,
}: {
  trabajadores: UsuarioRow[];
  trabajadorId: string;
  onTrabajador: (id: string) => void;
  categorias: Categoria[];
  onCategoria: (c: Categoria) => void;
  mostrarCanceladas: boolean;
  onCanceladas: (v: boolean) => void;
  soloCategorias?: boolean;
  servicios?: ServicioRow[];
  servicioId?: string;
  onServicio?: (id: string) => void;
}) {
  const opciones = [{ id: "", nombre: "Todos", apellido: "" }, ...trabajadores];
  return (
    <div className="ag-filtros">
      {!soloCategorias && <div className="ag-filtro">
        <h4>Especialistas</h4>
        {opciones.map((t) => (
          <label key={t.id || "todos"} className={`ag-opcion${trabajadorId === t.id ? " ag-opcion--activa" : ""}`}>
            <input type="radio" name="ag-especialista" checked={trabajadorId === t.id} onChange={() => onTrabajador(t.id)} />
            {`${t.nombre} ${t.apellido}`.trim()}
          </label>
        ))}
      </div>}

      <div className="ag-filtro">
        <h4>Servicios</h4>
        <div className="ag-chips">
          {TODAS_CATEGORIAS.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`ag-chip ag-chip--${cat}${categorias.includes(cat) ? " ag-chip--activo" : ""}`}
              aria-pressed={categorias.includes(cat)}
              onClick={() => onCategoria(cat)}
            >
              {CATEGORIAS[cat].label}
            </button>
          ))}
        </div>
      </div>

      {soloCategorias && servicios && onServicio && (
        <label className="ag-filtro">
          <h4>Servicio</h4>
          <select value={servicioId ?? ""} onChange={(e) => onServicio(e.target.value)}>
            <option value="">Todos los servicios</option>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}

      <label className="ag-check">
        <input type="checkbox" checked={mostrarCanceladas} onChange={(e) => onCanceladas(e.target.checked)} />
        Mostrar canceladas y no asistió
      </label>
    </div>
  );
}

// ─── Formulario: nueva cita ──────────────────────────────────────────────────

function FormularioCita({
  clientes,
  trabajadores,
  servicios,
  fechaInicial,
  onGuardar,
}: {
  clientes: ClienteRow[];
  trabajadores: UsuarioRow[];
  servicios: ServicioRow[];
  fechaInicial: string;
  onGuardar: (payload: CrearCitaPayload) => Promise<void>;
}) {
  const [f, setF] = useState({
    clienteId: "",
    trabajadorId: "",
    fecha: fechaInicial,
    horaInicio: "10:30",
    horaFin: "11:00",
    servicioId: "",
  });
  const [trabajadoresHabilitados, setTrabajadoresHabilitados] = useState<string[]>([]);
  const [cargandoTrabajadores, setCargandoTrabajadores] = useState(false);
  const [errorTrabajadores, setErrorTrabajadores] = useState<string | null>(null);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const errores = useMemo(() => {
    const e: Record<string, string> = {};
    if (!f.clienteId) e.clienteId = "Selecciona un cliente";
    if (!f.trabajadorId) e.trabajadorId = "Selecciona un trabajador habilitado para el servicio";
    if (!f.fecha) e.fecha = "La fecha es obligatoria";
    if (!f.horaInicio || !f.horaFin) {
      e.horaFin = "El horario es obligatorio";
    } else {
      const v = validateTimeRange(f.horaInicio, f.horaFin);
      if (!v.valid && v.error) e.horaFin = v.error;
    }
    if (!f.servicioId) e.servicioId = "Selecciona un servicio";
    if (f.fecha && f.horaInicio && f.horaFin) {
      const dia = new Date(`${f.fecha}T12:00:00`).getDay();
      const apertura = dia === 0 ? "11:00" : "10:30";
      const cierre = dia === 0 ? "18:00" : "21:00";
      if (f.horaInicio < apertura || f.horaFin > cierre) {
        e.horaFin = dia === 0
          ? "El domingo el horario es de 11:00 a 18:00."
          : "El horario de lunes a sábado es de 10:30 a 21:00.";
      }
    }
    return e;
  }, [f]);

  useEffect(() => {
    let cancelado = false;
    setTrabajadoresHabilitados([]);
    setErrorTrabajadores(null);
    setF((actual) => ({ ...actual, trabajadorId: "" }));
    if (!f.servicioId) return () => { cancelado = true; };

    setCargandoTrabajadores(true);
    obtenerIdsTrabajadoresPorServicio(f.servicioId)
      .then((ids) => {
        if (!cancelado) setTrabajadoresHabilitados(ids);
      })
      .catch((err: unknown) => {
        if (!cancelado) setErrorTrabajadores(mensajeError(err, "No se pudieron cargar los trabajadores del servicio."));
      })
      .finally(() => {
        if (!cancelado) setCargandoTrabajadores(false);
      });
    return () => { cancelado = true; };
  }, [f.servicioId]);

  // Al elegir servicio o cambiar la hora de inicio, la hora fin se propone según la duración del servicio.
  function proponerFin(servicioId: string, horaInicio: string) {
    const duracion = Number(servicios.find((s) => s.id === servicioId)?.duracion_minutos ?? 0);
    return duracion > 0 && horaInicio ? sumarMinutos(horaInicio, duracion) : null;
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIntento(true);
    if (Object.keys(errores).length > 0) return;
    const servicio = servicios.find((s) => s.id === f.servicioId);
    if (!servicio) return;

    try {
      setGuardando(true);
      setErrorLocal(null);
      await onGuardar({
        cliente_id: f.clienteId,
        trabajador_id: f.trabajadorId || null,
        fecha_cita: f.fecha,
        fecha: f.fecha,
        hora_inicio: f.horaInicio,
        hora_fin: f.horaFin,
        Estado: true,
        estado: "PENDIENTE",
        origen: "PWA_RECEPCION",
        notas: null,
        servicios: [
          {
            servicio_id: String(servicio.id ?? servicio.ID ?? ""),
            trabajador_id: f.trabajadorId || null,
            precio_aplicado: Number(servicio.precio_base ?? servicio.Precio ?? 0),
            duracion_minutos: Number(servicio.duracion_minutos ?? servicio.Duracion_minutos ?? 0),
            Cantidad: 1,
            orden: 1,
          },
        ],
      });
    } catch (err) {
      setErrorLocal(mensajeError(err, "No se pudo guardar la cita."));
      setGuardando(false);
    }
  }

  const mostrar = (campo: string) => (intento && errores[campo] ? <span className="ag-campo__error">{errores[campo]}</span> : null);

  return (
    <form onSubmit={enviar} className="ag-form" noValidate>
      <label className={`ag-campo${intento && errores.clienteId ? " ag-campo--error" : ""}`}>
        <span>Cliente</span>
        <select value={f.clienteId} onChange={(e) => setF({ ...f, clienteId: e.target.value })}>
          <option value="">Selecciona un cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.apellido ?? ""}
            </option>
          ))}
        </select>
        {mostrar("clienteId")}
      </label>

      <label className={`ag-campo${intento && errores.servicioId ? " ag-campo--error" : ""}`}>
        <span>Servicio</span>
        <select
          value={f.servicioId}
          onChange={(e) => {
            const fin = proponerFin(e.target.value, f.horaInicio);
            setF({ ...f, servicioId: e.target.value, horaFin: fin ?? f.horaFin });
          }}
        >
          <option value="">Selecciona un servicio</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        {mostrar("servicioId")}
      </label>

      <label className={`ag-campo${intento && errores.trabajadorId ? " ag-campo--error" : ""}`}>
        <span>Trabajador</span>
        <select
          value={f.trabajadorId}
          onChange={(e) => setF({ ...f, trabajadorId: e.target.value })}
          disabled={!f.servicioId || cargandoTrabajadores || Boolean(errorTrabajadores)}
        >
          <option value="">
            {!f.servicioId ? "Selecciona primero un servicio" : cargandoTrabajadores ? "Cargando trabajadores..." : "Selecciona un trabajador"}
          </option>
          {trabajadores.filter((trabajador) =>
            trabajador.rol === "trabajador" && trabajadoresHabilitados.includes(trabajador.id)
          ).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} {t.apellido}
            </option>
          ))}
        </select>
        {mostrar("trabajadorId")}
        {errorTrabajadores && <span className="ag-campo__error">{errorTrabajadores}</span>}
        {!cargandoTrabajadores && f.servicioId && !errorTrabajadores &&
          trabajadores.filter((trabajador) =>
            trabajador.rol === "trabajador" && trabajadoresHabilitados.includes(trabajador.id)
          ).length === 0 && <span className="ag-campo__error">No hay trabajadores asignados a este servicio.</span>}
      </label>

      <label className={`ag-campo${intento && errores.fecha ? " ag-campo--error" : ""}`}>
        <span>Fecha</span>
        <input type="date" min={new Date().toISOString().slice(0, 10)} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        {mostrar("fecha")}
      </label>

      <div className="ag-form__fila">
        <label className="ag-campo">
          <span>Hora de inicio</span>
          <input
            type="time"
            min={f.fecha && new Date(`${f.fecha}T12:00:00`).getDay() === 0 ? "11:00" : "10:30"}
            max={f.fecha && new Date(`${f.fecha}T12:00:00`).getDay() === 0 ? "18:00" : "21:00"}
            value={f.horaInicio}
            onChange={(e) => {
              const fin = proponerFin(f.servicioId, e.target.value);
              setF({ ...f, horaInicio: e.target.value, horaFin: fin ?? f.horaFin });
            }}
          />
        </label>
        <label className={`ag-campo${intento && errores.horaFin ? " ag-campo--error" : ""}`}>
          <span>Hora de fin</span>
          <input
            type="time"
            min={f.fecha && new Date(`${f.fecha}T12:00:00`).getDay() === 0 ? "11:00" : "10:30"}
            max={f.fecha && new Date(`${f.fecha}T12:00:00`).getDay() === 0 ? "18:00" : "21:00"}
            value={f.horaFin}
            onChange={(e) => setF({ ...f, horaFin: e.target.value })}
          />
        </label>
      </div>
      {mostrar("horaFin")}

      {errorLocal && <div className="ag-banner ag-banner--error">{errorLocal}</div>}

      <button type="submit" className="ag-btn ag-btn--primario" disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar cita"}
      </button>
    </form>
  );
}

// ─── Detalle de una cita ─────────────────────────────────────────────────────

function DetalleCita({
  cita,
  servicios,
  productos,
  onActualizada,
  onError,
  onAviso,
  soloLectura = false,
}: {
  cita: CitaConDetalle;
  servicios: ServicioRow[];
  productos: ProductoConLotes[];
  onActualizada: (c: CitaConDetalle) => void;
  onError: (m: string) => void;
  onAviso: (m: string) => void;
  soloLectura?: boolean;
}) {
  const [extraId, setExtraId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(accion: () => Promise<void>, ok: string, fallo: string) {
    try {
      setOcupado(true);
      await accion();
      onAviso(ok);
    } catch (err) {
      onError(mensajeError(err, fallo));
    } finally {
      setOcupado(false);
    }
  }

  function cambiarEstado(estado: EstadoCita) {
    if (estado === cita.estado) return;
    if (
      (estado === "CANCELADA" || estado === "NO_SHOW") &&
      !window.confirm(`¿Marcar la cita como "${ESTADOS[estado].label.toLowerCase()}"?`)
    ) {
      return;
    }
    void ejecutar(
      async () => {
        await cambiarEstadoCita(cita.id, estado !== "CANCELADA" && estado !== "NO_SHOW");
        onActualizada({ ...cita, estado });
      },
      "Estado actualizado",
      "No se pudo cambiar el estado.",
    );
  }

  function agregarServicio() {
    const servicio = servicios.find((s) => s.id === extraId);
    if (!servicio) return;
    const servicioId = String(servicio.id ?? servicio.ID ?? "");
    if (!servicioId) return;
    const trabajadorId = cita.trabajador_id;
    if (typeof trabajadorId !== "string" || !trabajadorId.trim()) {
      onError("La cita no tiene un trabajador asignado para añadir servicios.");
      return;
    }
    void ejecutar(
      async () => {
        const trabajadoresDisponibles = await obtenerIdsTrabajadoresPorServicio(servicioId);
        if (!trabajadoresDisponibles.includes(trabajadorId)) {
          throw new Error("El trabajador asignado no está habilitado para este servicio.");
        }
        const nueva = await actualizarCita(cita.id, {
          servicios: [
            ...cita.servicios.map(({ servicio_id, trabajador_id, precio_aplicado, duracion_minutos }) => ({
              servicio_id: String(servicio_id ?? ""),
              trabajador_id,
              precio_aplicado,
              duracion_minutos,
            })),
            {
              servicio_id: servicioId,
              trabajador_id: trabajadorId,
              precio_aplicado: Number(servicio.precio_base ?? servicio.Precio ?? 0),
              duracion_minutos: Number(servicio.duracion_minutos ?? servicio.Duracion_minutos ?? 0),
            },
          ],
        });
        onActualizada(nueva);
        setExtraId("");
      },
      "Servicio añadido",
      "No se pudo añadir el servicio.",
    );
  }

  function agregarProducto() {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return;
    const precio = Number(producto.precio_venta_publico ?? 0);
    const total = precio * cantidad;

    if (
      !window.confirm(
        `Se añadirá ${cantidad} × ${producto.nombre} a la cuenta pendiente de esta cita. Importe del producto: ${soles(total)}. ¿Continuar?`,
      )
    ) {
      return;
    }

    void ejecutar(
      async () => {
        const ventaExistente = await obtenerVentaPorCita(cita.id);
        if (ventaExistente) {
          await agregarProductoVenta(cita.id, producto.id, cantidad);
        } else {
          await crearVenta({
            Cliente_ID: cita.cliente_id,
            Usuario_ID: cita.trabajador_id ?? "",
            Cita_ID: cita.id,
            Metodo_Pago: null,
            servicios: cita.servicios.map((s) => ({
              Servicio_ID: s.servicio_id,
              Cantidad: 1,
              Precio_Unitario: s.precio_aplicado,
            })),
            productos: [
              {
                Producto_ID: producto.id,
                Cantidad: cantidad,
                Precio_Unitario: precio,
              },
            ],
          });
        }
        setProductoId("");
        setCantidad(1);
      },
      "Venta registrada",
      "No se pudo registrar la venta.",
    );
  }

  const fecha = parseISO(cita.fecha_cita ?? cita.fecha ?? new Date().toISOString().slice(0, 10));

  return (
    <div className="ag-detalle" style={{ "--c": colorCita(cita) } as CSSProperties}>
      <div className="ag-detalle__hero">
        <div>
          <strong>{nombreCliente(cita)}</strong>
          {cita.cliente?.telefono && (
            <a href={`tel:${cita.cliente.telefono}`} className="ag-detalle__tel">
              {cita.cliente.telefono}
            </a>
          )}
        </div>
        <EstadoPill estado={cita.estado} />
      </div>

      <dl className="ag-datos">
        <div>
          <dt>Fecha</dt>
          <dd>{capitalizar(format(fecha, "EEEE d 'de' MMMM", { locale: es }))}</dd>
        </div>
        <div>
          <dt>Horario</dt>
          <dd>
            {hhmm(cita.hora_inicio)} - {hhmm(cita.hora_fin)}
          </dd>
        </div>
        <div>
          <dt>Atiende</dt>
          <dd>{nombreTrabajador(cita)}</dd>
        </div>
        <div>
          <dt>Código</dt>
          <dd>{cita.codigo_cita}</dd>
        </div>
      </dl>

      <div className="ag-bloque">
        <h4>Servicios</h4>
        <ul className="ag-servicios">
          {cita.servicios.map((s, i) => (
            <li key={`${s.servicio_id}-${i}`}>
              <span>
                {s.nombre}
                <small> · {s.duracion_minutos} min</small>
              </span>
              <strong>{soles(s.precio_aplicado)}</strong>
            </li>
          ))}
          <li className="ag-servicios__total">
            <span>Monto estimado</span>
            <strong>{soles(cita.monto_estimado)}</strong>
          </li>
        </ul>
        {cita.notas && <p className="ag-notas">{cita.notas}</p>}
      </div>

      {!soloLectura && <div className="ag-bloque">
        <h4>Estado de la cita</h4>
        <div className="ag-estados">
          {(["PENDIENTE", "CANCELADA"] as EstadoCita[]).map((e) => (
            <button
              key={e}
              type="button"
              className={`ag-estado ag-estado--${ESTADOS[e].clase}${e === cita.estado ? " ag-estado--activo" : ""}`}
              onClick={() => cambiarEstado(e)}
              disabled={ocupado}
            >
              {ESTADOS[e].label}
            </button>
          ))}
        </div>
      </div>}

      {!soloLectura && <div className="ag-bloque">
        <h4>Añadir servicio</h4>
        <div className="ag-fila-accion">
          <select value={extraId} onChange={(e) => setExtraId(e.target.value)} aria-label="Servicio adicional">
            <option value="">Selecciona un servicio</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <button type="button" className="ag-btn" onClick={agregarServicio} disabled={!extraId || ocupado}>
            Añadir
          </button>
        </div>
      </div>}

      {!soloLectura && <div className="ag-bloque">
        <h4>Vender producto</h4>
        <div className="ag-fila-accion">
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)} aria-label="Producto">
            <option value="">Selecciona un producto</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Cantidad"
            className="ag-cantidad"
          />
          <button type="button" className="ag-btn" onClick={agregarProducto} disabled={!productoId || ocupado}>
            Vender
          </button>
        </div>
      </div>}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function CitasPage() {
  const { role, profile } = useAuth();
  const esTrabajador = role === "trabajador";
  const esEscritorio = useEsEscritorio();

  const [fecha, setFecha] = useState<Date>(() => new Date());
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false); // celular
  const [mesAbierto, setMesAbierto] = useState(false); // celular: ver menos (semana) ↔ ver más (todos los meses)
  const [ancla, setAncla] = useState<Date>(() => startOfMonth(new Date())); // celular: primer mes de la ventana
  const [saltosAHoy, setSaltosAHoy] = useState(0); // cada toque en "Ir a hoy" fuerza llevar el scroll al mes elegido
  const mesesRef = useRef<HTMLDivElement>(null);
  const toqueX = useRef<number | null>(null);
  const [vista, setVista] = useState<"semana" | "lista">("semana"); // escritorio

  const [trabajadorFiltro, setTrabajadorFiltro] = useState("");
  const [servicioFiltro, setServicioFiltro] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>(TODAS_CATEGORIAS);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);

  const [citas, setCitas] = useState<CitaConDetalle[]>([]);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);

  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [trabajadores, setTrabajadores] = useState<UsuarioRow[]>([]);
  const [servicios, setServicios] = useState<ServicioRow[]>([]);
  const [productos, setProductos] = useState<ProductoConLotes[]>([]);

  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Rango que se descarga: todas las semanas que toca el mes visible (cubre franja, mes y semana).
  // En celular se muestran 8 meses (1 antes y 6 después del ancla); en escritorio, el mes de la fecha.
  const mesesVentana = useMemo(() => Array.from({ length: 8 }, (_, i) => addMonths(ancla, i - 1)), [ancla]);
  const desde = format(startOfWeek(startOfMonth(esEscritorio ? fecha : mesesVentana[0]), WEEK), ISO);
  const hasta = format(endOfWeek(endOfMonth(esEscritorio ? fecha : mesesVentana[7]), WEEK), ISO);

  function centrarAnclaEn(d: Date) {
    if (esEscritorio) return;
    setAncla(startOfMonth(d));
  }

  // Al abrir "ver más": el calendario ocupa todo el espacio hasta la barra inferior (--ag-nav)
  // y la página de atrás no se desplaza.
  useEffect(() => {
    if (!mesAbierto) return;
    const ajustar = () => {
      const el = mesesRef.current;
      if (!el) return;
      const raiz = el.closest<HTMLElement>(".ag");
      const nav = raiz ? parseFloat(getComputedStyle(raiz).getPropertyValue("--ag-nav")) || 0 : 0;
      const flecha = 28; // alto del botón de ver menos
      el.style.height = `${Math.max(180, window.innerHeight - el.getBoundingClientRect().top - nav - flecha)}px`;
    };
    ajustar();
    const el = mesesRef.current;
    window.addEventListener("resize", ajustar);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", ajustar);
      document.body.style.overflow = previo;
      if (el) el.style.height = "";
    };
  }, [mesAbierto]);

  // Con "ver más" abierto, se baja hasta el mes de la fecha elegida: al abrirlo y también al tocar "Ir a hoy"
  // (si la ventana de meses se vuelve a centrar, el efecto corre otra vez cuando ya existe el mes).
  const claveMes = `${format(fecha, "yyyy-MM")}|${ancla.getTime()}`;
  useEffect(() => {
    if (!mesAbierto) return;
    const contenedor = mesesRef.current;
    const bloque = contenedor?.querySelector<HTMLElement>(`[data-mes="${format(fecha, "yyyy-MM")}"]`);
    if (contenedor && bloque) {
      contenedor.scrollTop += bloque.getBoundingClientRect().top - contenedor.getBoundingClientRect().top;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesAbierto, claveMes, saltosAHoy]);

  // Catálogos: una sola vez.
  useEffect(() => {
    let cancelado = false;
    Promise.all([esTrabajador ? Promise.resolve([]) : obtenerClientes(), obtenerServicios(), esTrabajador ? Promise.resolve([]) : obtenerUsuarios(true), esTrabajador ? Promise.resolve([]) : obtenerProductos({ soloActivos: true })])
      .then(([c, s, u, p]) => {
        if (cancelado) return;
        setClientes(c);
        setServicios(s);
        setTrabajadores(u);
        setProductos(p);
      })
      .catch((err) => !cancelado && setError(mensajeError(err, "No se pudieron cargar los catálogos.")));
    return () => {
      cancelado = true;
    };
  }, [esTrabajador]);

  // Citas: cada vez que cambia el mes visible, el filtro o se fuerza una recarga.
  useEffect(() => {
    let cancelado = false;
    if (!role || (esTrabajador && !profile?.ID)) {
      setCargando(true);
      return () => { cancelado = true; };
    }
    setCargando(true);
    obtenerCitas({ fechaDesde: desde, fechaHasta: hasta, trabajadorId: (esTrabajador ? String(profile?.ID ?? "") : trabajadorFiltro) || undefined })
      .then((data) => {
        if (cancelado) return;
        setCitas(data);
        setError(null);
      })
      .catch((err) => !cancelado && setError(mensajeError(err, "No se pudieron cargar las citas.")))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [desde, hasta, trabajadorFiltro, recarga, esTrabajador, profile?.ID, role]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 3500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const visibles = useMemo(
    () =>
      citas.filter(
        (c) =>
          categorias.includes(categoriaDe(c)) &&
          (!servicioFiltro || c.servicios.some((s) => s.servicio_id === servicioFiltro)) &&
          (mostrarCanceladas || (c.estado !== "CANCELADA" && c.estado !== "NO_SHOW")),
      ),
    [citas, categorias, mostrarCanceladas, servicioFiltro],
  );

  const porFecha = useMemo(() => {
    const mapa = new Map<string, CitaConDetalle[]>();
    for (const c of visibles) {
      const fechaKey = c.fecha_cita || c.fecha || "";
      if (!fechaKey) continue;
      mapa.set(fechaKey, [...(mapa.get(fechaKey) ?? []), c]);
    }
    mapa.forEach((lista) => lista.sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio)));
    return mapa;
  }, [visibles]);

  const marcados = useMemo(() => new Set(porFecha.keys()), [porFecha]);
  const seleccionada = citas.find((c) => c.id === seleccionadaId) ?? null;

  const diasSemana = eachDayOfInterval({ start: startOfWeek(fecha, WEEK), end: endOfWeek(fecha, WEEK) });
  const bloquesMes = esEscritorio
    ? []
    : mesesVentana.map((m) => ({
        m,
        dias: eachDayOfInterval({ start: startOfWeek(startOfMonth(m), WEEK), end: endOfWeek(endOfMonth(m), WEEK) }),
      }));

  const gruposDesde = (inicio: string, fin?: string) =>
    [...porFecha.entries()]
      .filter(([f]) => f >= inicio && (!fin || f <= fin))
      .sort(([a], [b]) => a.localeCompare(b));

  function alternarCategoria(cat: Categoria) {
    setCategorias((actuales) => (actuales.includes(cat) ? actuales.filter((c) => c !== cat) : [...actuales, cat]));
  }

  const filtros = (
    <Filtros
      trabajadores={trabajadores}
      trabajadorId={esTrabajador ? String(profile?.ID ?? "") : trabajadorFiltro}
      onTrabajador={setTrabajadorFiltro}
      categorias={categorias}
      onCategoria={alternarCategoria}
      mostrarCanceladas={mostrarCanceladas}
      onCanceladas={setMostrarCanceladas}
      soloCategorias={esTrabajador}
      servicios={esTrabajador ? servicios : undefined}
      servicioId={servicioFiltro}
      onServicio={setServicioFiltro}
    />
  );

  function irAHoy() {
    const hoy = new Date();
    setFecha(hoy);
    centrarAnclaEn(hoy);
    setSaltosAHoy((n) => n + 1);
  }
  function elegirDia(d: Date) {
    setFecha(d);
    centrarAnclaEn(d);
    setMesAbierto(false);
  }
  function alTocar(e: TouchEvent) {
    toqueX.current = e.touches[0].clientX;
  }
  function alSoltar(e: TouchEvent) {
    if (toqueX.current === null) return;
    const dx = e.changedTouches[0].clientX - toqueX.current;
    toqueX.current = null;
    if (Math.abs(dx) > 50) moverSemana(dx < 0 ? 1 : -1); // deslizar a la izquierda = semana siguiente
  }
  function moverSemana(delta: number) {
    setFecha((actual) => {
      const siguiente = addWeeks(actual, delta);
      if (!esEscritorio) {
        const nuevoMes = startOfMonth(siguiente);
        const minMes = startOfMonth(mesesVentana[0]);
        const maxMes = startOfMonth(mesesVentana[7]);
        if (nuevoMes < minMes || nuevoMes > maxMes) {
          setAncla(nuevoMes);
        }
      }
      return siguiente;
    });
  }

  function abrir(c: CitaConDetalle) {
    setMostrarForm(false);
    setSeleccionadaId(c.id);
  }
  function cerrarPanel() {
    setMostrarForm(false);
    setSeleccionadaId(null);
  }
  function nuevaCita() {
    setSeleccionadaId(null);
    setMostrarForm(true);
  }

  async function guardarCita(payload: CrearCitaPayload) {
    const citaFecha = payload.fecha_cita ?? payload.fecha ?? new Date().toISOString().slice(0, 10);
    await crearCita({
      ...payload,
      fecha_cita: citaFecha,
      fecha: citaFecha,
      trabajador_id: payload.trabajador_id || null,
      servicios: payload.servicios.map((s) => ({
        ...s,
        servicio_id: String(s.servicio_id ?? ""),
        trabajador_id: s.trabajador_id ?? payload.trabajador_id ?? null,
        Cantidad: s.Cantidad ?? 1,
      })),
    });
    const fechaCita = parseISO(citaFecha);
    setFecha(fechaCita); // parseISO evita el desfase de zona horaria de new Date("YYYY-MM-DD")
    centrarAnclaEn(fechaCita);
    setMostrarForm(false);
    setRecarga((n) => n + 1);
    setAviso("Cita creada");
  }

  function reemplazarCita(nueva: CitaConDetalle) {
    setCitas((actuales) => actuales.map((c) => (c.id === nueva.id ? nueva : c)));
  }

  const inicioSemana = startOfWeek(fecha, WEEK);
  const finSemana = endOfWeek(fecha, WEEK);
  const tituloSemana = `${format(inicioSemana, "d MMM", { locale: es })} – ${format(finSemana, "d MMM yyyy", { locale: es })}`;

  const panel =
    mostrarForm ? (
      <Panel titulo="Nueva cita" onCerrar={cerrarPanel}>
        <FormularioCita
          clientes={clientes}
          trabajadores={trabajadores}
          servicios={servicios}
          fechaInicial={format(fecha, ISO)}
          onGuardar={guardarCita}
        />
      </Panel>
    ) : seleccionada ? (
      <Panel titulo={tituloCita(seleccionada)} onCerrar={cerrarPanel}>
        <DetalleCita
          key={seleccionada.id}
          cita={seleccionada}
          servicios={servicios}
          productos={productos}
          soloLectura={esTrabajador}
          onActualizada={reemplazarCita}
          onError={setError}
          onAviso={setAviso}
        />
      </Panel>
    ) : null;

  const avisos = (
    <>
      {error && (
        <div className="ag-banner ag-banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="ag-icono" onClick={() => setError(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
      {aviso && (
        <div className="ag-banner ag-banner--ok" role="status">
          {aviso}
        </div>
      )}
    </>
  );

  // ── Escritorio ─────────────────────────────────────────────────────────────
  if (esEscritorio) {
    return (
      <div className="ag ag--escritorio">
        <aside className="ag-lateral">
          {!esTrabajador && <button type="button" className="ag-btn ag-btn--primario ag-btn--ancho" onClick={nuevaCita}>
            + Nueva cita
          </button>}

          {filtros}
        </aside>

        <main className="ag-principal">
          <div className="ag-barra">
            <div className="ag-barra__nav">
              <button type="button" className="ag-btn" onClick={() => setFecha(new Date())}>
                Hoy
              </button>
              <button type="button" className="ag-icono" onClick={() => moverSemana(-1)} aria-label="Semana anterior">
                ‹
              </button>
              <button type="button" className="ag-icono" onClick={() => moverSemana(1)} aria-label="Semana siguiente">
                ›
              </button>
              <h2>{tituloSemana}</h2>
              {cargando && <small className="ag-cargando">Actualizando…</small>}
            </div>
            <div className="ag-segmento" role="tablist">
              <button type="button" role="tab" aria-selected={vista === "semana"} onClick={() => setVista("semana")}>
                Semana
              </button>
              <button type="button" role="tab" aria-selected={vista === "lista"} onClick={() => setVista("lista")}>
                Lista
              </button>
            </div>
          </div>

          {avisos}

          {vista === "semana" ? (
            <SemanaGrid
              fecha={fecha}
              porFecha={porFecha}
              seleccionadaId={seleccionada?.id}
              onAbrir={abrir}
              onDia={setFecha}
            />
          ) : (
            <ListaPorDia
              grupos={gruposDesde(format(inicioSemana, ISO), format(finSemana, ISO))}
              seleccionadaId={seleccionada?.id}
              onAbrir={abrir}
              vacio="No hay citas esta semana"
            />
          )}
        </main>

        {panel}
      </div>
    );
  }

  // ── Celular ────────────────────────────────────────────────────────────────
  return (
    <div className={`ag ag--celular${mesAbierto ? " ag--abierto" : ""}`}>
      <div className="ag-tope">
        <div className="ag-tope__fila">
          <p>
            Estás viendo:
          </p>
          <button type="button" className="ag-btn ag-btn--borde" onClick={irAHoy}>
            Ir a hoy
          </button>
        </div>

        {mesAbierto ? (
          <div key="meses" className="ag-meses" ref={mesesRef}>
            {bloquesMes.map(({ m, dias }) => (
              <section key={format(m, "yyyy-MM")} data-mes={format(m, "yyyy-MM")} className="ag-mes">
                <h5>{capitalizar(format(m, "MMMM yyyy", { locale: es }))}</h5>
                <Dias dias={dias} mes={m} ocultarFuera seleccionado={fecha} marcados={marcados} onElegir={elegirDia} />
              </section>
            ))}
          </div>
        ) : (
          <div key="semana" onTouchStart={alTocar} onTouchEnd={alSoltar} className="ag-semana-celular">
            <Dias dias={diasSemana} seleccionado={fecha} marcados={marcados} onElegir={setFecha} />
          </div>
        )}

        <button
          type="button"
          className="ag-expandir"
          onClick={() => setMesAbierto((v) => !v)}
          aria-expanded={mesAbierto}
          aria-label={mesAbierto ? "Ver menos" : "Ver todo el calendario"}
        >
          <span className={mesAbierto ? "ag-expandir__flecha ag-expandir__flecha--arriba" : "ag-expandir__flecha"} />
        </button>
      </div>

      {avisos}

      {!esTrabajador && !mesAbierto && (
        <div className="ag-contenido">
          {!mesAbierto && (
            <div className="ag-filtros-celular">
              <button
                type="button"
                className="ag-btn ag-btn--borde"
                onClick={() => setFiltrosAbiertos((v) => !v)}
                aria-expanded={filtrosAbiertos}
              >
                {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
              </button>
              {filtrosAbiertos && filtros}
            </div>
          )}

          {cargando && citas.length === 0 ? (
            <div className="ag-vacio">
              <strong>Cargando agenda…</strong>
            </div>
          ) : (
            <ListaPorDia
              grupos={gruposDesde(format(fecha, ISO))}
              seleccionadaId={seleccionada?.id}
              onAbrir={abrir}
              vacio="No hay citas desde esta fecha"
            />
          )}
        </div>
      )}

      {!mesAbierto && (
        <button type="button" className="ag-fab" onClick={nuevaCita} aria-label="Nueva cita">
          +
        </button>
      )}

      {panel}
    </div>
  );
}
