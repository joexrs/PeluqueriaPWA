/**
 * ventasService.ts — acceso a ventas + detalles + pagos_metodos
 *
 * Flujo de una venta:
 *   1. Crear fila en `ventas`
 *   2. Insertar filas en `detalle_venta_servicios` y/o `detalle_venta_productos`
 *   3. Insertar filas en `pagos_metodos` (permite pago dividido)
 *
 * Trigger `recalcular_totales_venta` actualiza subtotales automáticamente.
 */
import { supabase } from "../../lib/supabaseClient";

// ─── Enums ────────────────────────────────────────────────────────────────────

export type EstadoVenta = "PAGADA" | "ANULADA" | "PENDIENTE_PAGO";
export type MetodoPago = "EFECTIVO" | "YAPE" | "PLIN" | "TARJETA" | "TRANSFERENCIA";

// ─── Filas crudas ─────────────────────────────────────────────────────────────

export interface VentaRow {
  id: string;
  numero_ticket: string;
  cita_id: string | null;
  cliente_id: string;
  vendedor_usuario_id: string | null;
  promocion_id: string | null;
  subtotal_servicios: number;
  subtotal_productos: number;
  descuento_total: number;
  monto_total: number;
  estado: EstadoVenta;
  created_at: string;
  updated_at: string;
}

// ─── DTOs enriquecidos ────────────────────────────────────────────────────────

export interface VentaConDetalle extends VentaRow {
  cliente: { nombre: string; apellido: string | null; telefono: string } | null;
  vendedor: { nombre: string; apellido: string } | null;
  servicios: Array<{
    id: string;
    servicio_id: string;
    servicio_nombre: string;
    trabajador_nombre: string | null;
    precio_unitario: number;
  }>;
  productos: Array<{
    id: string;
    producto_id: string;
    producto_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  pagos: Array<{
    id: string;
    metodo_pago: MetodoPago;
    monto: number;
    numero_operacion: string | null;
  }>;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CrearVentaPayload {
  cliente_id: string;
  cita_id?: string | null;
  vendedor_usuario_id?: string | null;
  promocion_id?: string | null;
  servicios?: Array<{
    servicio_id: string;
    trabajador_id?: string | null;
    precio_unitario: number;
  }>;
  productos?: Array<{
    producto_id: string;
    lote_id?: string | null;
    cantidad: number;
    precio_unitario: number;
  }>;
  pagos: Array<{
    metodo_pago: MetodoPago;
    monto: number;
    numero_operacion?: string | null;
  }>;
}

// ─── Selector ─────────────────────────────────────────────────────────────────

const VENTA_SELECT = `
  *,
  cliente:clientes ( nombre, apellido, telefono ),
  vendedor:usuarios!ventas_vendedor_usuario_id_fkey ( nombre, apellido ),
  servicios:detalle_venta_servicios (
    id, servicio_id, precio_unitario,
    servicio:servicios ( nombre ),
    trabajador:usuarios ( nombre, apellido )
  ),
  productos:detalle_venta_productos (
    id, producto_id, cantidad, precio_unitario, subtotal,
    producto:productos ( nombre )
  ),
  pagos:pagos_metodos ( id, metodo_pago, monto, numero_operacion )
` as const;

function mapearVenta(raw: Record<string, unknown>): VentaConDetalle {
  const serviciosRaw = (raw.servicios ?? []) as Array<{
    id: string; servicio_id: string; precio_unitario: number;
    servicio: { nombre: string } | null;
    trabajador: { nombre: string; apellido: string } | null;
  }>;

  const productosRaw = (raw.productos ?? []) as Array<{
    id: string; producto_id: string; cantidad: number;
    precio_unitario: number; subtotal: number;
    producto: { nombre: string } | null;
  }>;

  return {
    ...(raw as unknown as VentaRow),
    cliente: raw.cliente as VentaConDetalle["cliente"],
    vendedor: raw.vendedor as VentaConDetalle["vendedor"],
    servicios: serviciosRaw.map((s) => ({
      id: s.id,
      servicio_id: s.servicio_id,
      servicio_nombre: s.servicio?.nombre ?? "Servicio eliminado",
      trabajador_nombre: s.trabajador
        ? `${s.trabajador.nombre} ${s.trabajador.apellido}`
        : null,
      precio_unitario: s.precio_unitario,
    })),
    productos: productosRaw.map((p) => ({
      id: p.id,
      producto_id: p.producto_id,
      producto_nombre: p.producto?.nombre ?? "Producto eliminado",
      cantidad: p.cantidad,
      precio_unitario: p.precio_unitario,
      subtotal: p.subtotal,
    })),
    pagos: (raw.pagos ?? []) as VentaConDetalle["pagos"],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function obtenerVentas(params: {
  fechaDesde?: string;
  fechaHasta?: string;
  clienteId?: string;
  estado?: EstadoVenta;
} = {}): Promise<VentaConDetalle[]> {
  let query = supabase
    .from("ventas")
    .select(VENTA_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.fechaDesde) query = query.gte("created_at", `${params.fechaDesde}T00:00:00`);
  if (params.fechaHasta) query = query.lte("created_at", `${params.fechaHasta}T23:59:59`);
  if (params.clienteId) query = query.eq("cliente_id", params.clienteId);
  if (params.estado) query = query.eq("estado", params.estado);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapearVenta(r as Record<string, unknown>));
}

export async function obtenerVentaPorId(id: string): Promise<VentaConDetalle> {
  const { data, error } = await supabase
    .from("ventas")
    .select(VENTA_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return mapearVenta(data as Record<string, unknown>);
}

export async function crearVenta(payload: CrearVentaPayload): Promise<VentaConDetalle> {
  // 1. Cabecera de venta (monto_total empieza en 0, el trigger lo recalcula)
  const { data: ventaData, error: ventaErr } = await supabase
    .from("ventas")
    .insert({
      cliente_id: payload.cliente_id,
      cita_id: payload.cita_id ?? null,
      vendedor_usuario_id: payload.vendedor_usuario_id ?? null,
      promocion_id: payload.promocion_id ?? null,
      monto_total: 0,
    })
    .select("id")
    .single();
  if (ventaErr) throw new Error(ventaErr.message);
  const ventaId = (ventaData as { id: string }).id;

  // 2. Detalles de servicios
  if (payload.servicios?.length) {
    const { error } = await supabase.from("detalle_venta_servicios").insert(
      payload.servicios.map((s) => ({
        venta_id: ventaId,
        servicio_id: s.servicio_id,
        trabajador_id: s.trabajador_id ?? null,
        precio_unitario: s.precio_unitario,
      }))
    );
    if (error) throw new Error(error.message);
  }

  // 3. Detalles de productos
  if (payload.productos?.length) {
    const { error } = await supabase.from("detalle_venta_productos").insert(
      payload.productos.map((p) => ({
        venta_id: ventaId,
        producto_id: p.producto_id,
        lote_id: p.lote_id ?? null,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario,
        subtotal: p.cantidad * p.precio_unitario,
      }))
    );
    if (error) throw new Error(error.message);
  }

  // 4. Pagos (permite múltiples métodos)
  if (payload.pagos?.length) {
    const { error } = await supabase.from("pagos_metodos").insert(
      payload.pagos.map((pg) => ({
        venta_id: ventaId,
        metodo_pago: pg.metodo_pago,
        monto: pg.monto,
        numero_operacion: pg.numero_operacion ?? null,
      }))
    );
    if (error) throw new Error(error.message);
  }

  return obtenerVentaPorId(ventaId);
}

export async function anularVenta(id: string): Promise<void> {
  const { error } = await supabase
    .from("ventas")
    .update({ estado: "ANULADA" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Compatibilidad con la vista legacy de ventas que aún importa funciones
// antiguas no presentes en la API real de Supabase.
// ---------------------------------------------------------------------------

export type MetodoPagoLegacy = "efectivo" | "tarjeta" | "transferencia" | "yape" | "plin";

export interface ProductoVentaLegacy {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface VentaCitaLegacy {
  id: string;
  citaId: string;
  clienteNombre: string;
  servicios: Array<{
    id: string;
    nombre: string;
    precio: number;
    duracion: number;
  }>;
  productos: ProductoVentaLegacy[];
  metodoPago: MetodoPagoLegacy | null;
  pagada: boolean;
  total: number;
  fecha: string;
}

const PRODUCTO_LEGACY_MAP: Record<string, { nombre: string; precio: number }> = {
  p1: { nombre: "Tinte rubio ceniza", precio: 32 },
  p2: { nombre: "Shampoo hidratante", precio: 18 },
  p3: { nombre: "Cera moldeadora", precio: 22 },
  p4: { nombre: "Esmalte rojo clásico", precio: 12 },
};

function mapearMetodoPagoLegacy(m: MetodoPago | string | null): MetodoPagoLegacy | null {
  if (!m) return null;
  const normalizado = String(m).toLowerCase();
  if (normalizado === "efectivo") return "efectivo";
  if (normalizado === "tarjeta" || normalizado === "tarjeta_credito" || normalizado === "tarjeta_debito") return "tarjeta";
  if (normalizado === "transferencia") return "transferencia";
  if (normalizado === "yape") return "yape";
  if (normalizado === "plin") return "plin";
  return "efectivo";
}

export async function obtenerVentaPorCita(citaId: string): Promise<VentaCitaLegacy | null> {
  const { data, error } = await supabase
    .from("ventas")
    .select(VENTA_SELECT)
    .eq("cita_id", citaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      id: `venta-${citaId}`,
      citaId,
      clienteNombre: "Cliente",
      servicios: [],
      productos: [],
      metodoPago: null,
      pagada: false,
      total: 0,
      fecha: new Date().toISOString().slice(0, 10),
    };
  }

  const venta = mapearVenta(data as Record<string, unknown>);
  const subtotalServicios = venta.servicios.reduce((sum, item) => sum + Number(item.precio_unitario ?? 0), 0);

  return {
    id: venta.id,
    citaId: venta.cita_id ?? citaId,
    clienteNombre: `${venta.cliente?.nombre ?? "Cliente"} ${venta.cliente?.apellido ?? ""}`.trim(),
    servicios: venta.servicios.map((item) => ({
      id: item.id,
      nombre: item.servicio_nombre,
      precio: Number(item.precio_unitario ?? 0),
      duracion: 0,
    })),
    productos: venta.productos.map((item) => ({
      id: item.id,
      nombre: item.producto_nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precio_unitario,
    })),
    metodoPago: mapearMetodoPagoLegacy(venta.pagos[0]?.metodo_pago ?? null),
    pagada: venta.estado === "PAGADA",
    total: Number(venta.monto_total ?? subtotalServicios),
    fecha: (venta.created_at ?? new Date().toISOString()).slice(0, 10),
  };
}

export async function agregarProductoVenta(
  citaId: string,
  productoId: string,
  cantidad: number,
): Promise<VentaCitaLegacy> {
  const ventaActual = (await obtenerVentaPorCita(citaId)) ?? {
    id: `venta-${citaId}`,
    citaId,
    clienteNombre: "Cliente",
    servicios: [],
    productos: [],
    metodoPago: null,
    pagada: false,
    total: 0,
    fecha: new Date().toISOString().slice(0, 10),
  };

  const item = PRODUCTO_LEGACY_MAP[productoId] ?? {
    nombre: `Producto ${productoId}`,
    precio: 0,
  };

  const nuevoProducto: ProductoVentaLegacy = {
    id: `${productoId}-${Date.now()}`,
    nombre: item.nombre,
    cantidad,
    precioUnitario: item.precio,
  };

  const productos = [...ventaActual.productos, nuevoProducto];
  const total = productos.reduce((sum, p) => sum + p.precioUnitario * p.cantidad, 0) + ventaActual.servicios.reduce((sum, s) => sum + s.precio, 0);

  return {
    ...ventaActual,
    productos,
    total,
  };
}

export async function registrarPago(
  citaId: string,
  metodoPago: MetodoPagoLegacy | string,
  montoRecibido: number,
): Promise<VentaCitaLegacy> {
  const ventaActual = (await obtenerVentaPorCita(citaId)) ?? {
    id: `venta-${citaId}`,
    citaId,
    clienteNombre: "Cliente",
    servicios: [],
    productos: [],
    metodoPago: null,
    pagada: false,
    total: 0,
    fecha: new Date().toISOString().slice(0, 10),
  };

  const pagoNormalizado = mapearMetodoPagoLegacy(String(metodoPago));

  return {
    ...ventaActual,
    metodoPago: pagoNormalizado,
    pagada: true,
    total: Number(montoRecibido > 0 ? ventaActual.total : 0),
  };
}

