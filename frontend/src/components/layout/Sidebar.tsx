import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { navItemsForRole } from "./navItems";

export default function Sidebar() {
  const { role } = useAuth();
  const itemsVisibles = useMemo(() => navItemsForRole(role), [role]);

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
