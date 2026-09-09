export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

export interface ServicioCita {
  id: string;
  nombre: string;
  precio: number;
  duracion: number;
}

export interface ProductoVenta {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface VentaCita {
  id: string;
  citaId: string;
  clienteNombre: string;
  servicios: ServicioCita[];
  productos: ProductoVenta[];
  metodoPago: MetodoPago | null;
  pagada: boolean;
  total: number;
  fecha: string;
}
