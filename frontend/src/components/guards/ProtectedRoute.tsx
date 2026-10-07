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
  const { user, profile, role, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Verificando sesión…</p>
      </div>
    );
  }

  // No hay sesión → redirigir al login guardando la ruta intentada
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const profileRole = Array.isArray(profile?.Rol) ? profile.Rol[0] : profile?.Rol;
  if (profileError || !profile || !profile.Estado || !role || profileRole?.Estado !== true) {
    return (
      <div className="auth-loading">
        <div className="auth-error-icon">⚠️</div>
        <p>{profileError ?? "La cuenta no tiene un perfil activo vinculado. Contacta al administrador."}</p>
      </div>
    );
  }

  return <>{children}</>;
}
