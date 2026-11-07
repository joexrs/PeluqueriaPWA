export interface ReporteVentas {
  totalVentas: number;
  totalServicios: number;
  totalProductos: number;
  cantidadVentas: number;
  ticketPromedio: number;
  serviciosMasVendidos: ItemRanking[];
  productosMasVendidos: ItemRanking[];
}

export interface ItemRanking {
  id: string;
  nombre: string;
  cantidad: number;
  total: number;
}

export interface CuadreCaja {
  efectivo: number;
  yape: number;
  plin: number;
  tarjeta: number;
  transferencia: number;
  total: number;
}

export interface ComisionTrabajador {
  id: string;
  nombre: string;
  cantidadServicios: number;
  totalServicios: number;
  porcentajeComision: number;
  montoComision: number;
}
