// Tipos para la tabla "Producto" segun schema.sql
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Producto = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Movimiento = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Lote = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CategoriaProducto = Record<string, any>;

export interface CrearProductoPayload {
  Nombre?: string;
  Descripcion?: string | null;
  Marca?: string | null;
  Codigo?: string | null;
  Precio?: number;
  Categoria_id?: string | null;

  // Alias de compatibilidad
  nombre?: string;
  marca?: string;
  categoria_id?: string | null;
  precio_venta_publico?: number;
  codigo_barras?: string | null;
}

export interface CrearLotePayload {
  Producto_id: string;
  Fecha_vencimiento: string;
  Cantidad: number;

  // Alias de compatibilidad
  producto_id?: string;
  cantidad?: number;
  fecha_caducidad?: string;
}

export interface CrearMovimientoPayload {
  Producto_id: string;
  Cantidad: number;
  Tipo: "Entrada" | "Salida";

  // Alias de compatibilidad
  producto_id?: string;
  cantidad?: number;
}

export interface FiltroProductos {
  busqueda?: string;
  soloActivos?: boolean;
  categoriaId?: string;
}

export interface FiltroMovimientos {
  productoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipo?: "Entrada" | "Salida";
}

// Tipos legacy para compatibilidad
export interface ProductoConLotes extends Producto {
  lotes: Lote[];
  proximo_a_vencer?: string | null;
}

export interface RegistrarEntradaPayload {
  producto_id: string;
  cantidad: number;
  fecha_caducidad: string;
}

export interface RegistrarSalidaPayload {
  producto_id: string;
  cantidad: number;
  lote_id?: string;
}