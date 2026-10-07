// Tipos para las tablas de Ventas segun schema.sql
// Usamos un tipo permisivo para compatibilidad

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Venta = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Venta_Detalle = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Promocion = Record<string, any>;

export interface VentaConDetalle extends Venta {
  Cliente?: {
    ID: string;
    Nombre: string;
    Apellido: string;
    Telefono: string;
  } | null;
  Usuario?: {
    ID: string;
    Nombre: string;
    Apellido: string;
  } | null;
  detalles: Array<{
    ID: string;
    servicio_id?: string | null;
    producto_id?: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    estado_detalle: "Pendiente" | "Pagado" | "Cancelado";
    Servicio?: { Nombre: string; Duracion_minutos?: number } | null;
    Producto?: { Nombre: string } | null;
  }>;
}

export interface CrearVentaPayload {
  Cliente_ID: string;
  Usuario_ID: string;
  Cita_ID?: string | null;
  Metodo_Pago?: string | null;
  servicios?: Array<{
    Servicio_ID: string;
    Cantidad: number;
    Precio_Unitario: number;
  }>;
  productos?: Array<{
    Producto_ID: string;
    Cantidad: number;
    Precio_Unitario: number;
  }>;
}

export interface FiltroVentas {
  fechaDesde?: string;
  fechaHasta?: string;
  clienteId?: string;
  estado?: "Pendiente" | "Pagado" | "Cancelado";
}

// Tipos legacy para compatibilidad
export type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "yape" | "plin";

export interface VentaCita {
  id: string;
  citaId: string;
  clienteNombre: string;
  servicios: Array<{ id: string; nombre: string; precio: number; duracion: number }>;
  productos: Array<{ id: string; nombre: string; cantidad: number; precioUnitario: number }>;
  metodoPago: MetodoPago | null;
  pagada: boolean;
  total: number;
  fecha: string;
}

export interface ProductoVenta {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}