import type { Producto, Movimiento } from "./types";

// Mock data para desarrollo sin conexion a BD
export const PRODUCTOS_INICIALES: Producto[] = [
  { ID: "p1", Nombre: "Shampoo hidratante", Marca: "L'Oréal", Precio: 25, Stock_total: 10, Estado: true },
  { ID: "p2", Nombre: "Mascarilla reparadora", Marca: "Kerastase", Precio: 35, Stock_total: 5, Estado: true },
  { ID: "p3", Nombre: "Cera moldeadora", Marca: "American Crew", Precio: 20, Stock_total: 8, Estado: true },
  { ID: "p4", Nombre: "Gel fijador", Marca: "John Frieda", Precio: 18, Stock_total: 3, Estado: true },
];

export const MOVIMIENTOS_INICIALES: Movimiento[] = [
  { ID: "m1", Cantidad: 10, Tipo: "Entrada", Fecha_movimiento: "2026-01-15", Lote_id: "l1", Producto_id: "p1" },
  { ID: "m2", Cantidad: 5, Tipo: "Salida", Fecha_movimiento: "2026-01-20", Lote_id: "l1", Producto_id: "p1" },
];