/**
 * ProtectedRoute.tsx
 * Guard de ruta que impide el acceso a usuarios no autenticados.
 * Redirige al login si no hay sesión activa.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, cargando, perfil } = useAuth();
  const location = useLocation();

  // Mientras cargamos la sesión, mostramos un loader
  if (cargando) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Verificando sesión…</p>
      </div>
    );
  }

  // No hay sesión → redirigir al login guardando la ruta intentada
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // El usuario está autenticado en Supabase Auth pero no tiene perfil
  // en la tabla `usuarios` o está inactivo → denegar acceso
  if (perfil && !perfil.activo) {
    return (
      <div className="auth-loading">
        <div className="auth-error-icon">⚠️</div>
        <p>Tu cuenta ha sido desactivada. Contacta al administrador.</p>
      </div>
    );
  }

  return <>{children}</>;
}
