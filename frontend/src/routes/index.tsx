import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import LoginPage from "../pages/login/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import CitasPage from "../pages/citas/CitasPage";
import ClientesPage from "../pages/clientes/ClientesPage";
import ProductosPage from "../pages/productos/ProductosPage";
import ServiciosPage from "../pages/servicios/ServiciosPage";
import PromocionesPage from "../pages/promociones/PromocionesPage";
import VentasPage from "../pages/ventas/VentasPage";
import UsuariosPage from "../pages/usuarios/UsuariosPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/citas" element={<CitasPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/servicios" element={<ServiciosPage />} />
          <Route path="/promociones" element={<PromocionesPage />} />
          <Route path="/ventas" element={<VentasPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
