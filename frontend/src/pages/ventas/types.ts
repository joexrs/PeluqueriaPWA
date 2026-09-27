export type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "yape" | "plin";

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
  servicios: Array<{
    id: string;
    nombre: string;
    precio: number;
    duracion: number;
  }>;
  productos: ProductoVenta[];
  metodoPago: MetodoPago | null;
  pagada: boolean;
  total: number;
  fecha: string;
}
