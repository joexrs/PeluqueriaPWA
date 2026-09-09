import { useLocation } from "react-router-dom";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/citas": "Citas",
  "/clientes": "Clientes",
  "/productos": "Productos",
  "/servicios": "Servicios",
  "/promociones": "Promociones",
  "/ventas": "Ventas",
  "/usuarios": "Usuarios",
};

export default function Topbar() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "Panel";

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="topbar-user">
        <span className="topbar-user-avatar">JR</span>
      </div>
    </header>
  );
}
