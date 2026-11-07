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
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { RolUsuario } from "../../pages/usuarios/usuariosService";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: RolUsuario[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard, roles: ["admin", "jefe", "trabajador", "recepcionista"] },
  { to: "/citas", label: "Citas", icon: Calendar, roles: ["admin", "jefe", "trabajador", "recepcionista"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "jefe", "recepcionista"] },
  { to: "/ventas", label: "Ventas", icon: ShoppingCart, roles: ["admin", "jefe", "recepcionista"] },
  { to: "/reportes", label: "Reportes", icon: BarChart3, roles: ["admin", "jefe"] },
  { to: "/promociones", label: "Promos", icon: Tag, roles: ["admin", "jefe"] },
  { to: "/productos", label: "Productos", icon: Package, roles: ["admin", "jefe"] },
  { to: "/servicios", label: "Servicios", icon: Sparkles, roles: ["admin", "jefe"] },
  { to: "/trabajadores", label: "Trabajadores", icon: BriefcaseBusiness, roles: ["admin", "jefe"] },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, roles: ["admin"] },
];

const DOCK_PATHS = ["/dashboard", "/citas", "/clientes", "/ventas"];

export function navItemsForRole(role: RolUsuario | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function dockItemsForRole(role: RolUsuario | null): NavItem[] {
  const visibles = navItemsForRole(role);
  const fijos = DOCK_PATHS.map((path) => visibles.find((item) => item.to === path)).filter(
    (item): item is NavItem => Boolean(item),
  );
  if (fijos.length >= 4) return fijos.slice(0, 4);
  const extra = visibles.filter((item) => !fijos.some((fijo) => fijo.to === item.to));
  return [...fijos, ...extra].slice(0, 4);
}
