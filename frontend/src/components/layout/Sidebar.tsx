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

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/citas", label: "Citas", icon: Calendar },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/servicios", label: "Servicios", icon: Sparkles },
  { to: "/promociones", label: "Promos", icon: Tag },
  { to: "/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/usuarios", label: "Usuarios", icon: UserCog },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-badge">P</span>
        <span className="sidebar-brand-name">Peluquería</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
