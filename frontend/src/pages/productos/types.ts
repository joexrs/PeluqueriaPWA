// ─── Tipos USER-DEFINED de Supabase ──────────────────────────────────────────

export type TipoMovimiento =
  | "ENTRADA_COMPRA"
  | "SALIDA_USO_SERVICIO"
  | "SALIDA_VENTA"
  | "AJUSTE_POSITIVO"
  | "AJUSTE_NEGATIVO"
  | "DEVOLUCION"
  | "CADUCIDAD";

// ─── Filas crudas de Supabase ─────────────────────────────────────────────────

export interface ProductoRow {
  id: string;
  categoria_id: string | null;
  proveedor_id: string | null;
  codigo_barras: string | null;
  nombre: string;
  marca: string;
  unidad_medida: string;
  stock_total: number;
  stock_minimo: number;
  precio_venta_publico: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoteProductoRow {
  id: string;
  producto_id: string;
  numero_lote: string;
  costo_unitario: number;
  cantidad_inicial: number;
  stock_actual: number;
  fecha_ingreso: string;   // "YYYY-MM-DD"
  fecha_caducidad: string | null;
}

export interface MovimientoInventarioRow {
  id: string;
  lote_id: string | null;
  producto_id: string;
  usuario_id: string | null;
  tipo_movimiento: TipoMovimiento;
  cantidad: number;
  motivo: string;
  fecha_movimiento: string; // ISO timestamp
}

// ─── DTOs enriquecidos ────────────────────────────────────────────────────────

export interface ProductoConLotes extends ProductoRow {
  categoria?: { id: string; nombre: string } | null;
  proveedor?: { id: string; razon_social: string } | null;
  lotes: LoteProductoRow[];
  // lote más próximo a vencer (para alertas)
  proximo_a_vencer: string | null;
}

export interface MovimientoConProducto extends MovimientoInventarioRow {
  producto?: { nombre: string; marca: string } | null;
  lote?: { numero_lote: string } | null;
  usuario?: { nombre: string; apellido: string } | null;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CrearProductoPayload {
  nombre: string;
  marca: string;
  categoria_id?: string | null;
  proveedor_id?: string | null;
  codigo_barras?: string | null;
  unidad_medida?: string;
  stock_minimo?: number;
  precio_venta_publico: number;
}

export interface RegistrarEntradaPayload {
  producto_id: string;
  numero_lote: string;
  costo_unitario: number;
  cantidad: number;
  fecha_caducidad?: string | null;
  motivo?: string;
}

export interface RegistrarSalidaPayload {
  lote_id: string;
  producto_id: string;
  cantidad: number;
  tipo: "SALIDA_USO_SERVICIO" | "SALIDA_VENTA" | "AJUSTE_NEGATIVO" | "CADUCIDAD" | "DEVOLUCION";
  motivo: string;
  usuario_id?: string;
}

export interface FiltroProductos {
  busqueda?: string;
  soloStockBajo?: boolean;
  categoriaId?: string;
  soloActivos?: boolean;
}

export interface FiltroMovimientos {
  productoId?: string;
  loteId?: string;
  tipo?: TipoMovimiento;
  fechaDesde?: string;
  fechaHasta?: string;
}

// ─── Tipo legacy para compatibilidad con ProductosPage.tsx y MovimientoForm.tsx ──
// (la UI actual usa este shape; se migra en paralelo)

export interface Producto {
  id: string;
  nombre: string;
  marca: string;
  tipo: string;           // = categoria.nombre
  proveedor?: string;     // = proveedor.razon_social
  stock: number;          // = stock_total
  stockMin: number;       // = stock_minimo
  caducidad: string | null; // = lote más próximo a vencer
}

export interface Movimiento {
  id: string;
  productoId: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  fecha: string;
}
