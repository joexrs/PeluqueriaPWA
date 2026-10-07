/**
 * RoleGuard.tsx
 * Guard de ruta que restringe el acceso según el rol del usuario.
 * Solo permite la renderización si el rol del usuario está en la lista
 * de roles permitidos.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { RolUsuario } from "../../pages/usuarios/usuariosService";

interface RoleGuardProps {
  /** Roles que tienen acceso a esta ruta */
  rolesPermitidos: RolUsuario[];
  /** Ruta a la que redirigir si no tiene permiso (default: /dashboard) */
  redirigirA?: string;
  children: React.ReactNode;
}

export default function RoleGuard({
  rolesPermitidos,
  redirigirA = "/dashboard",
  children,
}: RoleGuardProps) {
  const { role, loading } = useAuth();

  // Mientras carga, no mostrar nada (ProtectedRoute ya muestra loader)
  if (loading) return null;

  // ProtectedRoute presenta el error si no se pudo recuperar el perfil.
  if (!role) return null;

  // Verificar si el rol del usuario está permitido
  if (!rolesPermitidos.includes(role)) {
    return <Navigate to={redirigirA} replace />;
  }

  return <>{children}</>;
}
