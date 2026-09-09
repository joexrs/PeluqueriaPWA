export interface Producto {
  id: string;
  nombre: string;
  marca: string;
  tipo: string;
  proveedor?: string;
  stock: number;
  stockMin: number;
  caducidad: string | null; // YYYY-MM-DD
}

export type TipoMovimiento = "entrada" | "salida";

export interface Movimiento {
  id: string;
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  fecha: string; // YYYY-MM-DD
}
