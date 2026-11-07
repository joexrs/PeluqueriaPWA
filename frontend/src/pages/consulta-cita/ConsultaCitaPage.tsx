import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Search, Calendar, Clock, Scissors, User, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { consultarCitasPorDNI } from "./consultaService";
import type { CitaConsultaPublica } from "./types";
import "./consultaCita.css";

export default function ConsultaCitaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citas, setCitas] = useState<CitaConsultaPublica[] | null>(null);
  const [dniConsultado, setDniConsultado] = useState("");

  async function handleConsultar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dniLimpio = dni.trim().replace(/[^0-9a-zA-Z]/g, "");

    if (!dniLimpio || dniLimpio.length < 4) {
      setError("Por favor, ingresa un número de DNI o documento válido (mínimo 4 caracteres).");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const resultado = await consultarCitasPorDNI(dniLimpio);
      setCitas(resultado);
      setDniConsultado(dniLimpio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo realizar la consulta.");
      setCitas(null);
    } finally {
      setLoading(false);
    }
  }

  function formatFecha(fechaStr: string) {
    if (!fechaStr) return "";
    try {
      const [year, month, day] = fechaStr.split("-").map(Number);
      const fecha = new Date(year, month - 1, day);
      return fecha.toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return fechaStr;
    }
  }

  function getEstadoClase(estado: string) {
    switch (estado.toUpperCase()) {
      case "CONFIRMADA":
        return "estado-confirmada";
      case "PENDIENTE":
        return "estado-pendiente";
      case "EN_ATENCION":
        return "estado-en-atencion";
      case "COMPLETADA":
        return "estado-completada";
      case "CANCELADA":
      case "NO_SHOW":
        return "estado-cancelada";
      default:
        return "estado-pendiente";
    }
  }

  const hoyStr = new Date().toISOString().split("T")[0];
  const proximasCitas = citas ? citas.filter((c) => c.fecha_cita >= hoyStr && c.estado_cita !== "CANCELADA" && c.estado_cita !== "NO_SHOW") : [];
  const historialCitas = citas ? citas.filter((c) => c.fecha_cita < hoyStr || c.estado_cita === "COMPLETADA" || c.estado_cita === "CANCELADA" || c.estado_cita === "NO_SHOW") : [];

  return (
    <div className="consulta-page">
      {/* Barra de navegación superior con candado para el personal */}
      <header className="consulta-navbar">
        <div className="consulta-brand">
          <img src="/LogoWM.png" alt="Victor Manuel Peluqueros" className="consulta-logo" />
          <div className="consulta-brand-text">
            <h1>Victor Manuel Peluqueros</h1>
            <p>Peluquería &amp; Estética</p>
          </div>
        </div>

        <div className="consulta-nav-actions">
          {user ? (
            <button
              className="btn-lock"
              onClick={() => navigate("/dashboard")}
              title="Ir al panel administrativo"
            >
              <Sparkles />
              <span>Ir al Panel</span>
            </button>
          ) : (
            <button
              className="btn-lock"
              onClick={() => navigate("/login")}
              title="Acceso exclusivo para el personal del salón"
            >
              <Lock />
              <span>Acceso Personal</span>
            </button>
          )}
        </div>
      </header>

      {/* Contenedor principal de consulta */}
      <main className="consulta-container">
        <div className="consulta-header">
          <span className="consulta-badge">Portal de Clientes</span>
          <h2>Consulta el estado de tu Cita</h2>
          <p>
            Ingresa tu número de DNI para verificar el horario, servicio y profesional asignado a tu cita.
          </p>
        </div>

        {/* Tarjeta de búsqueda */}
        <div className="consulta-search-card">
          <form className="consulta-form" onSubmit={handleConsultar}>
            <div className="consulta-input-group">
              <Search />
              <input
                type="text"
                className="consulta-input"
                placeholder="Ingresa tu número de DNI"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>
            <button type="submit" className="consulta-btn-submit" disabled={loading}>
              {loading ? "Consultando..." : "Consultar Citas"}
            </button>
          </form>

          {error && <div className="consulta-error">{error}</div>}
        </div>

        {/* Resultados */}
        {citas !== null && (
          <div className="consulta-results">
            {citas.length === 0 ? (
              <div className="cita-empty">
                <Calendar />
                <h3>No encontramos citas registradas</h3>
                <p>
                  No hay citas asociadas al documento <strong>{dniConsultado}</strong>.
                  Si crees que se trata de un error, por favor comunícate con el salón para verificar tu registro.
                </p>
              </div>
            ) : (
              <>
                {proximasCitas.length > 0 && (
                  <div>
                    <h3 className="consulta-section-title">
                      <Sparkles style={{ width: 20, height: 20, color: "var(--color-accent)" }} />
                      Tus Próximas Citas
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {proximasCitas.map((cita) => (
                        <article key={cita.cita_id} className="cita-card">
                          <div className="cita-card-top">
                            <div className="cita-fecha">
                              <Calendar style={{ width: 18, height: 18, color: "var(--color-accent)" }} />
                              <span style={{ textTransform: "capitalize" }}>{formatFecha(cita.fecha_cita)}</span>
                            </div>
                            <span className={`cita-estado-pill ${getEstadoClase(cita.estado_cita)}`}>
                              {cita.estado_cita.replace("_", " ")}
                            </span>
                          </div>

                          <div className="cita-card-body">
                            <div className="cita-info-item">
                              <span className="cita-info-label">Horario programado</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Clock style={{ width: 16, height: 16, color: "var(--color-ink-muted)" }} />
                                <span className="cita-info-value">
                                  {cita.hora_inicio.slice(0, 5)} - {cita.hora_fin.slice(0, 5)}
                                </span>
                              </div>
                            </div>

                            <div className="cita-info-item">
                              <span className="cita-info-label">Servicio(s)</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Scissors style={{ width: 16, height: 16, color: "var(--color-ink-muted)" }} />
                                <span className="cita-info-value">{cita.servicios}</span>
                              </div>
                            </div>

                            <div className="cita-info-item">
                              <span className="cita-info-label">Estilista / Barbero</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <User style={{ width: 16, height: 16, color: "var(--color-ink-muted)" }} />
                                <span className="cita-info-value">{cita.barbero}</span>
                              </div>
                            </div>

                            <div className="cita-info-item">
                              <span className="cita-info-label">Cliente</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <CheckCircle2 style={{ width: 16, height: 16, color: "#16a34a" }} />
                                <span className="cita-info-value">{cita.cliente_nombre}</span>
                              </div>
                            </div>
                          </div>

                          <div className="cita-card-footer">
                            💡 Te recomendamos presentarte 5 a 10 minutos antes de tu horario programado.
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {historialCitas.length > 0 && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <h3 className="consulta-section-title">
                      <Clock style={{ width: 20, height: 20, color: "var(--color-ink-muted)" }} />
                      Historial Anterior
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {historialCitas.map((cita) => (
                        <article key={cita.cita_id} className="cita-card" style={{ opacity: 0.85 }}>
                          <div className="cita-card-top">
                            <div className="cita-fecha">
                              <span style={{ textTransform: "capitalize" }}>{formatFecha(cita.fecha_cita)}</span>
                            </div>
                            <span className={`cita-estado-pill ${getEstadoClase(cita.estado_cita)}`}>
                              {cita.estado_cita.replace("_", " ")}
                            </span>
                          </div>

                          <div className="cita-card-body">
                            <div className="cita-info-item">
                              <span className="cita-info-label">Horario</span>
                              <span className="cita-info-value">
                                {cita.hora_inicio.slice(0, 5)} - {cita.hora_fin.slice(0, 5)}
                              </span>
                            </div>
                            <div className="cita-info-item">
                              <span className="cita-info-label">Servicio</span>
                              <span className="cita-info-value">{cita.servicios}</span>
                            </div>
                            <div className="cita-info-item">
                              <span className="cita-info-label">Atendido por</span>
                              <span className="cita-info-value">{cita.barbero}</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Pie de página sutil */}
      <footer className="consulta-footer">
        <p>© {new Date().getFullYear()} Victor Manuel Peluqueros. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

