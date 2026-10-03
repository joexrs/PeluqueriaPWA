/**
 * PublicOnlyRoute.tsx
 * Guard inverso: solo permite acceso a usuarios NO autenticados.
 * Si el usuario ya tiene sesión, lo redirige al dashboard.
 * Útil para la página de login.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function PublicOnlyRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Cargando…</p>
      </div>
    );
  }

  // Si ya está autenticado, enviar al dashboard
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
