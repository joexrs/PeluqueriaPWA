import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Plus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { dockItemsForRole, navItemsForRole } from "./navItems";

export default function MobileNav() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const items = useMemo(() => navItemsForRole(role), [role]);
  const dockItems = useMemo(() => dockItemsForRole(role), [role]);
  const mostrarMas = items.length > dockItems.length;

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuAbierto(false);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuAbierto]);

  if (items.length === 0) return null;

  return (
    <div className="mobile-nav">
      {menuAbierto && (
        <div className="mobile-nav-overlay" onClick={() => setMenuAbierto(false)}>
          <div
            className="mobile-nav-sheet"
            role="dialog"
            aria-label="Módulos"
            onClick={(event) => event.stopPropagation()}
          >
            <nav className="mobile-nav-list">
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `mobile-nav-list-item${isActive ? " is-active" : ""}`
                  }
                >
                  <span className="mobile-nav-list-icon">
                    <Icon size={24} strokeWidth={1.8} />
                  </span>
                  <span className="mobile-nav-list-label">{label}</span>
                  <ChevronRight size={20} strokeWidth={1.75} className="mobile-nav-list-arrow" />
                </NavLink>
              ))}
            </nav>

            <div className="mobile-nav-sheet-footer">
              <button
                type="button"
                className="mobile-nav-close"
                onClick={() => setMenuAbierto(false)}
              >
                <span>Cerrar</span>
                <span className="mobile-nav-close-x" aria-hidden>
                  <X size={18} strokeWidth={2.4} />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className={`mobile-nav-dock${menuAbierto ? " menu-open" : ""}`} aria-label="Navegación principal">
        {dockItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `mobile-nav-dock-item${isActive ? " is-active" : ""}`}
          >
            <Icon size={24} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}

        {mostrarMas && (
          <button
            type="button"
            className={`mobile-nav-more${menuAbierto ? " is-open" : ""}`}
            aria-label={menuAbierto ? "Cerrar menú de módulos" : "Ver más módulos"}
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <Plus size={24} strokeWidth={2.2} style={{ transition: 'transform 0.3s ease' }} />
          </button>
        )}
      </nav>
    </div>
  );
}
