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
  BriefcaseBusiness,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { RolUsuario } from "../../pages/usuarios/usuariosService";

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: RolUsuario[];
}> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "jefe", "trabajador", "recepcionista"] },
  { to: "/citas", label: "Citas", icon: Calendar, roles: ["admin", "jefe", "trabajador", "recepcionista"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "jefe", "recepcionista"] },
  { to: "/productos", label: "Productos", icon: Package, roles: ["admin", "jefe"] },
  { to: "/servicios", label: "Servicios", icon: Sparkles, roles: ["admin", "jefe"] },
  { to: "/promociones", label: "Promos", icon: Tag, roles: ["admin", "jefe", "recepcionista"] },
  { to: "/ventas", label: "Ventas", icon: ShoppingCart, roles: ["admin", "jefe", "recepcionista"] },
  { to: "/trabajadores", label: "Trabajadores", icon: BriefcaseBusiness, roles: ["admin", "jefe"] },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, roles: ["admin"] },
];

export default function Sidebar() {
  const { role } = useAuth();

  const itemsVisibles = useMemo(() => {
    if (!role) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(role));
  }, [role]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          src="/LogoWM.png"
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
            <Icon size={18} strokeWidth={1.25} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
