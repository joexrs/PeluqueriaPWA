import { useEffect, useMemo, useState } from "react";
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
import { obtenerMiPerfil, type RolUsuario } from "../../pages/usuarios/usuariosService";

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
  const [rol, setRol] = useState<RolUsuario | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargarRol() {
      try {
        const perfil = await obtenerMiPerfil();
        if (!cancelado) {
          setRol(perfil?.rol ?? "admin");
        }
      } catch {
        if (!cancelado) {
          setRol("admin");
        }
      }
    }

    void cargarRol();

    return () => {
      cancelado = true;
    };
  }, []);

  const itemsVisibles = useMemo(() => {
    if (!rol) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(rol));
  }, [rol]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-badge">P</span>
        <span className="sidebar-brand-name">Peluquería</span>
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
