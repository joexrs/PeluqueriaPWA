import { useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

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
  const { perfil, cerrarSesion } = useAuth();
  const title = TITLES[pathname] ?? "Panel";

  // Iniciales del usuario para el avatar
  const iniciales = perfil
    ? `${perfil.nombre.charAt(0)}${perfil.apellido.charAt(0)}`.toUpperCase()
    : "??";

  async function handleLogout() {
    await cerrarSesion();
    navigate("/login", { replace: true });
  }

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="topbar-user">
        {perfil && (
          <span className="topbar-user-name">
            {perfil.nombre} {perfil.apellido}
          </span>
        )}
        <span className="topbar-user-avatar" title={perfil?.email ?? ""}>
          {iniciales}
        </span>
        <button
          className="topbar-logout-btn"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={18} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
