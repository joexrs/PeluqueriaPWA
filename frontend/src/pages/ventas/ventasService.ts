import type { MetodoPago, VentaCita } from "./types";
import { VENTAS_INICIALES } from "./mockData";

const PRODUCTOS_STOCK: Record<string, { nombre: string; stock: number; precio: number }> = {
  p1: { nombre: "Tinte rubio ceniza", stock: 8, precio: 18 },
  p2: { nombre: "Shampoo hidratante", stock: 3, precio: 14 },
  p3: { nombre: "Cera moldeadora", stock: 0, precio: 12 },
  p4: { nombre: "Esmalte rojo clásico", stock: 12, precio: 9 },
};

let ventas: VentaCita[] = [...VENTAS_INICIALES];

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export async function obtenerVentaPorCita(citaId: string): Promise<VentaCita | null> {
  await esperar();
  return ventas.find((venta) => venta.citaId === citaId) ?? null;
}

export async function agregarProductoVenta(citaId: string, productoId: string, cantidad: number): Promise<VentaCita> {
  await esperar();

  const venta = ventas.find((item) => item.citaId === citaId);
  if (!venta) throw new Error("No existe una venta para esta cita.");

  const stockProducto = PRODUCTOS_STOCK[productoId];
  if (!stockProducto) throw new Error("Producto no encontrado.");
  if (cantidad <= 0) throw new Error("La cantidad debe ser mayor que cero.");
  if (stockProducto.stock < cantidad) {
    throw new Error(`Stock insuficiente: solo quedan ${stockProducto.stock} unidades de ${stockProducto.nombre}.`);
  }

  const productoExistente = venta.productos.find((item) => item.id === productoId);
  const nuevoProducto = {
    id: productoId,
    nombre: stockProducto.nombre,
    cantidad: productoExistente ? productoExistente.cantidad + cantidad : cantidad,
    precioUnitario: stockProducto.precio,
  };

  const productosActualizados = productoExistente
    ? venta.productos.map((item) => (item.id === productoId ? nuevoProducto : item))
    : [...venta.productos, nuevoProducto];

  const totalProductos = productosActualizados.reduce(
    (sum, item) => sum + item.precioUnitario * item.cantidad,
    0,
  );

  const ventaActualizada: VentaCita = {
    ...venta,
    productos: productosActualizados,
    total: venta.servicios.reduce((sum, servicio) => sum + servicio.precio, 0) + totalProductos,
  };

  ventas = ventas.map((item) => (item.citaId === citaId ? ventaActualizada : item));
  PRODUCTOS_STOCK[productoId].stock -= cantidad;

  return ventaActualizada;
}

export async function registrarPago(citaId: string, metodoPago: MetodoPago, monto: number): Promise<VentaCita> {
  await esperar();

  const venta = ventas.find((item) => item.citaId === citaId);
  if (!venta) throw new Error("La venta no existe.");
  if (monto < venta.total) {
    throw new Error("El importe recibido es inferior al total de la venta.");
  }

  const ventaActualizada: VentaCita = {
    ...venta,
    metodoPago,
    pagada: true,
    total: venta.total,
  };

  ventas = ventas.map((item) => (item.citaId === citaId ? ventaActualizada : item));
  return ventaActualizada;
}
