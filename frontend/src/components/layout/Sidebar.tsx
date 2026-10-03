import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Package,
  Sparkles,
  Tag,
  ShoppingCart,
  UserCog,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { RolUsuario } from "../../pages/usuarios/usuariosService";
import logoPelu from "../../assets/Logo_pelu.png";

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: RolUsuario[];
}> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"]},
  { to: "/citas", label: "Citas", icon: Calendar, roles: ["admin", "trabajador", "recepcionista"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "recepcionista"] },
  { to: "/productos", label: "Productos", icon: Package, roles: ["admin",] },
  { to: "/servicios", label: "Servicios", icon: Sparkles, roles: ["admin"] },
  { to: "/promociones", label: "Promos", icon: Tag, roles: ["admin", "recepcionista"] },
  { to: "/ventas", label: "Ventas", icon: ShoppingCart, roles: ["admin", "recepcionista"] },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, roles: ["admin"] },
];

export default function Sidebar() {
  const { perfil } = useAuth();

  const itemsVisibles = useMemo(() => {
    if (!perfil) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(perfil.rol));
  }, [perfil]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          src={logoPelu}
          alt="Victor Manuel Peluqueros"
          className="sidebar-brand-logo"
        />
        <span className="sidebar-brand-name">VM Peluqueros</span>
      </div>

      <nav className="sidebar-nav">
        {itemsVisibles.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " is-active" : ""}`
            }
          >
            <Icon size={18} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
