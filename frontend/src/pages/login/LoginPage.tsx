import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { iniciarSesion } from "./loginService";
import type { LoginState } from "./types";

const formInicial: LoginState = {
  email: "manager@peluqueria.com",
  password: "password123",
  remember: true,
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginState>(formInicial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      navigate("/dashboard");
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
          <div className="login-brand-mark">P</div>
          <div>
            <p className="login-kicker">Internal Portal</p>
            <h1>Peluquería</h1>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Bienvenido</p>
          <h2>Accede a tu agenda y operaciones</h2>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>

          <label>
            <span>Contraseña</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
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
