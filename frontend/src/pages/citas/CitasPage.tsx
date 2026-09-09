import { useEffect, useMemo, useState } from "react";
import { Calendar, Views, dateFnsLocalizer } from "react-big-calendar";
import type { View } from "react-big-calendar";
import { addDays, format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { obtenerCitasPorFiltro } from "./citasService";
import type { CitaAgenda, CategoriaCita, Especialista } from "./types";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2023, 9, 25));
  const [view, setView] = useState<View>(Views.WEEK);
  const [selectedStaff, setSelectedStaff] = useState<Especialista>("Todos");
  const [selectedServices, setSelectedServices] = useState<CategoriaCita[]>(["hair", "nails", "skin"]);

  const selectedDay = selectedDate.getDate();

  useEffect(() => {
    let cancelled = false;

    async function cargarCitas() {
      try {
        setLoading(true);
        const data = await obtenerCitasPorFiltro({
          day: selectedDay,
          staff: selectedStaff,
          services: selectedServices,
        });

        if (!cancelled) {
          setCitas(data);
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
