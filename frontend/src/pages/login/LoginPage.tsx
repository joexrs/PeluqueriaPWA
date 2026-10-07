import { useNavigate, useLocation } from "react-router-dom";
import { useState, type FormEvent } from "react";
import type { LoginState } from "./types";
import { validators } from "../../lib/validators";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const formInicial: LoginState = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [form, setForm] = useState<LoginState>(formInicial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [shake, setShake] = useState(false);

  // Validate individual field
  function validateField(field: "email" | "password", value: string): string | undefined {
    if (field === "email") {
      return validators.compose(
        validators.required("El correo electrónico es obligatorio"),
        validators.email("Ingresa un correo electrónico válido")
      ).validate(value).error;
    }
    if (field === "password") {
      return validators.required("La contraseña es obligatoria").validate(value).error;
    }
    return undefined;
  }

  // Validate all fields
  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    const emailError = validateField("email", form.email);
    const passwordError = validateField("password", form.password);
    
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleFieldBlur(field: "email" | "password") {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, form[field]);
    setFormErrors((prev) => ({ ...prev, [field]: error || "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    // Mark all fields as touched
    setTouched({ email: true, password: true });
    
    if (!validateForm()) {
      setError("Por favor, corrige los errores antes de continuar.");
      setLoading(false);
      return;
    }
    
    setError(null);
    setLoading(true);

    try {
      const result = await signIn(form.email, form.password);

      if (!result.ok) {
        setError(result.message);
        setShake(true);
        setTimeout(() => setShake(false), 300);
        return;
      }

      // Redirigir a la ruta original que intentó acceder, o al dashboard
      const destino = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <img
            src="/LogoWM.png"
            alt="Victor Manuel Peluqueros"
            className="login-brand-logo"
          />
          <div>
            <p className="login-kicker">Peluquería & Estética</p>
            <h1>Victor Manuel Peluqueros</h1>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Bienvenido</p>
          <h2>Accede a tu agenda y operaciones</h2>
        </div>

        <form className={`login-form${shake ? " shake" : ""}`} onSubmit={handleSubmit}>
          <label className={touched.email && formErrors.email ? "has-error" : ""}>
            <span>Correo electrónico</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              onBlur={() => handleFieldBlur("email")}
              placeholder="correo@ejemplo.com"
            />
            {touched.email && formErrors.email && <span className="field-error">{formErrors.email}</span>}
          </label>

          <label className={touched.password && formErrors.password ? "has-error" : ""}>
            <span>Contraseña</span>
            <div className="input-wrapper">
              <input
                type={mostrarPassword ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                onBlur={() => handleFieldBlur("password")}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? <EyeOff size={18} strokeWidth={1.25} /> : <Eye size={18} strokeWidth={1.25} />}
              </button>
            </div>
            {touched.password && formErrors.password && <span className="field-error">{formErrors.password}</span>}
          </label>

          <div className="login-meta">
            <button type="button" className="inline-link">¿Olvidaste tu contraseña?</button>
          </div>

          {error && <div className="banner-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading && <span className="spinner-small" />}
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>

      <div className="login-visual">
        
      </div>
    </div>
  );
}
