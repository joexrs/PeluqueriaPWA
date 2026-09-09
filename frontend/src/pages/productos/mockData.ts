import type { Producto, Movimiento } from "./types";

export const PRODUCTOS_INICIALES: Producto[] = [
  { id: "p1", nombre: "Tinte rubio ceniza", marca: "Wella", tipo: "Tinte", proveedor: "Distribuidora Bella", stock: 8, stockMin: 5, caducidad: "2026-12-01" },
  { id: "p2", nombre: "Shampoo hidratante", marca: "L'Oréal", tipo: "Shampoo", proveedor: "Distribuidora Bella", stock: 3, stockMin: 5, caducidad: "2027-03-15" },
  { id: "p3", nombre: "Cera moldeadora", marca: "Fixx", tipo: "Cera", stock: 0, stockMin: 3, caducidad: null },
  { id: "p4", nombre: "Esmalte rojo clásico", marca: "OPI", tipo: "Esmalte", proveedor: "Nails Import", stock: 12, stockMin: 4, caducidad: "2028-01-10" },
];

export const MOVIMIENTOS_INICIALES: Movimiento[] = [
  { id: "m1", productoId: "p1", tipo: "entrada", cantidad: 10, fecha: "2026-08-10" },
  { id: "m2", productoId: "p1", tipo: "salida", cantidad: 2, fecha: "2026-08-15" },
];
