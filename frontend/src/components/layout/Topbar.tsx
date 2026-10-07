import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "./ThemeToggle";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/citas": "Citas",
  "/clientes": "Clientes",
  "/productos": "Productos",
  "/servicios": "Servicios",
  "/promociones": "Promociones",
  "/ventas": "Ventas",
  "/trabajadores": "Trabajadores",
  "/usuarios": "Usuarios",
};

export default function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const title = TITLES[pathname] ?? "Panel";

  // Iniciales del usuario para el avatar
  const iniciales = profile
    ? `${profile.Nombre.charAt(0)}${profile.Apellido.charAt(0)}`.toUpperCase()
    : "??";

  async function handleLogout() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "No se pudo cerrar la sesión.");
    }
  }

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="topbar-user">
        {profile && (
          <span className="topbar-user-name">
            {profile.Nombre} {profile.Apellido}
          </span>
        )}
        <span className="topbar-user-avatar" title={profile?.Usuario ?? ""}>
          {iniciales}
        </span>
        <ThemeToggle />
        {logoutError && <span role="alert">{logoutError}</span>}
        <button
          className="topbar-logout-btn"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={18} strokeWidth={1.25} />
        </button>
      </div>
    </header>
  );
}
