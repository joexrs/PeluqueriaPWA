/**
 * Rutas de la aplicación.
 *
 * Estructura de seguridad:
 * ─ /login          → PublicOnlyRoute  (redirige al dashboard si ya está autenticado)
 * ─ /dashboard      → ProtectedRoute   (requiere sesión + perfil activo)
 * ─ /citas          → ProtectedRoute + RoleGuard (admin, jefe, trabajador, recepcionista)
 * ─ /clientes       → ProtectedRoute + RoleGuard (admin, jefe, recepcionista)
 * ─ /productos      → ProtectedRoute + RoleGuard (admin, jefe)
 * ─ /servicios      → ProtectedRoute + RoleGuard (admin, jefe)
 * ─ /promociones    → ProtectedRoute + RoleGuard (admin, jefe)
 * ─ /ventas         → ProtectedRoute + RoleGuard (admin, jefe, recepcionista)
 * ─ /trabajadores   → ProtectedRoute + RoleGuard (admin, jefe)
 * ─ /usuarios       → ProtectedRoute + RoleGuard (admin)
 * ─ *               → Redirige a /login (catch-all para rutas no definidas)
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "../components/guards/ProtectedRoute";
import RoleGuard from "../components/guards/RoleGuard";
import PublicOnlyRoute from "../components/guards/PublicOnlyRoute";
import LoginPage from "../pages/login/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import CitasPage from "../pages/citas/CitasPage";
import ClientesPage from "../pages/clientes/ClientesPage";
import ProductosPage from "../pages/productos/ProductosPage";
import ServiciosPage from "../pages/servicios/ServiciosPage";
import PromocionesPage from "../pages/promociones/PromocionesPage";
import VentasPage from "../pages/ventas/VentasPage";
import TrabajadoresPage from "../pages/trabajadores/TrabajadoresPage";
import UsuariosPage from "../pages/usuarios/UsuariosPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Ruta pública: solo accesible sin sesión ── */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        {/* ── Rutas protegidas: requieren autenticación ── */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard — todos los roles autenticados */}
          <Route
            path="/dashboard"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe", "trabajador", "recepcionista"]}>
                <DashboardPage />
              </RoleGuard>
            }
          />

          {/* Citas — todos los roles operativos */}
          <Route
            path="/citas"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe", "trabajador", "recepcionista"]}>
                <CitasPage />
              </RoleGuard>
            }
          />

          {/* Clientes — admin, jefe, recepcionista */}
          <Route
            path="/clientes"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe", "recepcionista"]}>
                <ClientesPage />
              </RoleGuard>
            }
          />

          {/* Productos — admin, jefe */}
          <Route
            path="/productos"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe"]}>
                <ProductosPage />
              </RoleGuard>
            }
          />

          {/* Servicios — admin, jefe */}
          <Route
            path="/servicios"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe"]}>
                <ServiciosPage />
              </RoleGuard>
            }
          />

          {/* Promociones — admin, jefe (según las políticas de escritura de la tabla) */}
          <Route
            path="/promociones"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe"]}>
                <PromocionesPage />
              </RoleGuard>
            }
          />

          {/* Ventas — admin, jefe, recepcionista */}
          <Route
            path="/ventas"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe", "recepcionista"]}>
                <VentasPage />
              </RoleGuard>
            }
          />

          {/* Trabajadores — admin, jefe */}
          <Route
            path="/trabajadores"
            element={
              <RoleGuard rolesPermitidos={["admin", "jefe"]}>
                <TrabajadoresPage />
              </RoleGuard>
            }
          />

          {/* Usuarios — solo admin */}
          <Route
            path="/usuarios"
            element={
              <RoleGuard rolesPermitidos={["admin"]}>
                <UsuariosPage />
              </RoleGuard>
            }
          />
        </Route>

        {/* ── Redirecciones ── */}
        <Route index element={<Navigate to="/login" replace />} />

        {/* Catch-all: cualquier ruta no definida → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
