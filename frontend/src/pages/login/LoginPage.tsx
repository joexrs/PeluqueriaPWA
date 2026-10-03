import { useNavigate, useLocation } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { iniciarSesion } from "./loginService";
import type { LoginState } from "./types";
import { validators } from "../../lib/validators";
import logoPelu from "../../assets/Logo_pelu.png";

const formInicial: LoginState = {
  email: "",
  password: "",
  remember: false,
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState<LoginState>(formInicial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Validate individual field
  function validateField(field: "email" | "password", value: string): string | undefined {
    if (field === "email") {
      return validators.compose(
        validators.required("El correo electrónico es obligatorio"),
        validators.email("Ingresa un correo electrónico válido")
      ).validate(value).error;
    }
    if (field === "password") {
      return validators.compose(
        validators.required("La contraseña es obligatoria"),
        validators.minLength(6, "La contraseña debe tener al menos 6 caracteres")
      ).validate(value).error;
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
      const result = await iniciarSesion({
        email: form.email,
        password: form.password,
        remember: form.remember,
      });

      if (!result.ok) {
        setError(result.message);
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
            src={logoPelu}
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

        <form className="login-form" onSubmit={handleSubmit}>
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

          <label className={touched.password && formErrors.password ? "has-error" : ""}>
            <span>Contraseña</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              onBlur={() => handleFieldBlur("password")}
              placeholder="••••••••"
            />
            {touched.password && formErrors.password && <span className="field-error">{formErrors.password}</span>}
          </label>

          <div className="login-meta">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => setForm((prev) => ({ ...prev, remember: e.target.checked }))}
              />
              <span>Recordarme</span>
            </label>
            <button type="button" className="inline-link">¿Olvidaste tu contraseña?</button>
          </div>

          {error && <div className="banner-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
      </div>

      <div className="login-visual">
        
      </div>
    </div>
  );
}
