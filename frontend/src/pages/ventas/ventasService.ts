/**
 * ventasService.ts — acceso directo a las tablas de Ventas segun schema.sql
 */
import { supabase } from "../../lib/supabaseClient";
import type {
  Venta,
  VentaConDetalle,
  CrearVentaPayload,
  FiltroVentas,
  Promocion,
  VentaCita,
  MetodoPago,
} from "./types";

// Interfaces Raw de Supabase
interface ClienteRaw {
  ID: unknown;
  Nombre: unknown;
  Apellido: unknown;
  Telefono: unknown;
}

interface UsuarioRaw {
  ID: unknown;
  Nombre: unknown;
  Apellido: unknown;
}

interface Venta_DetalleRaw {
  ID: unknown;
  Venta_ID: unknown;
  Servicio_ID: unknown;
  Producto_ID: unknown;
  Cantidad: unknown;
  Precio_Unitario: unknown;
  Subtotal: unknown;
  Estado_Detalle: unknown;
  Servicio: unknown;
  Producto: unknown;
}

interface ServicioRaw {
  Nombre: unknown;
  Duracion_minutos: unknown;
}

interface ProductoRaw {
  Nombre: unknown;
}

/**
 * Mapea una fila cruda de Venta
 */
function mapVenta(row: Record<string, unknown>): Venta {
  return {
    ID: String(row.ID ?? ""),
    Cliente_ID: String(row.Cliente_ID ?? ""),
    Usuario_ID: String(row.Usuario_ID ?? ""),
    Fecha_Venta: row.Fecha_Venta ? String(row.Fecha_Venta) : "",
    Total: Number(row.Total ?? 0),
    Cita_ID: row.Cita_ID ? String(row.Cita_ID) : null,
    Metodo_Pago: row.Metodo_Pago ? String(row.Metodo_Pago) : null,
    Estado_Venta: (row.Estado_Venta as "Pendiente" | "Pagado" | "Cancelado") || "Pendiente",
    Created_at: row.Created_at ? String(row.Created_at) : undefined,
    Updated_at: row.Updated_at ? String(row.Updated_at) : undefined,
  };
}

/**
 * Mapea una fila cruda de Cliente
 */
function mapCliente(row: ClienteRaw) {
  return {
    ID: String(row.ID ?? ""),
    Nombre: String(row.Nombre ?? ""),
    Apellido: row.Apellido ? String(row.Apellido) : "",
    Telefono: row.Telefono ? String(row.Telefono) : "",
  };
}

/**
 * Mapea una fila cruda de Usuario
 */
function mapUsuario(row: UsuarioRaw) {
  return {
    ID: String(row.ID ?? ""),
    Nombre: String(row.Nombre ?? ""),
    Apellido: row.Apellido ? String(row.Apellido) : "",
  };
}

/**
 * Mapea una fila cruda de Venta_Detalle
 */
function mapVenta_Detalle(row: Venta_DetalleRaw): VentaConDetalle["detalles"][0] {
  const serv = row.Servicio as ServicioRaw | null;
  const prod = row.Producto as ProductoRaw | null;
  return {
    ID: String(row.ID ?? ""),
    servicio_id: row.Servicio_ID ? String(row.Servicio_ID) : null,
    producto_id: row.Producto_ID ? String(row.Producto_ID) : null,
    cantidad: Number(row.Cantidad ?? 1),
    precio_unitario: Number(row.Precio_Unitario ?? 0),
    subtotal: Number(row.Subtotal ?? 0),
    estado_detalle: (row.Estado_Detalle as "Pendiente" | "Pagado" | "Cancelado") || "Pendiente",
    Servicio: serv
      ? {
          Nombre: String(serv.Nombre ?? ""),
          Duracion_minutos: Number(serv.Duracion_minutos ?? 0),
        }
      : null,
    Producto: prod ? { Nombre: String(prod.Nombre ?? "") } : null,
  };
}

/**
 * Obtiene ventas con filtros
 */
export async function obtenerVentas(filtros: FiltroVentas = {}): Promise<VentaConDetalle[]> {
  let query = supabase
    .from("Venta")
    .select(`
      *,
      Cliente:Cliente(ID, Nombre, Apellido, Telefono),
      Usuario:Usuario(ID, Nombre, Apellido),
      detalles:Venta_Detalle(
        ID, Venta_ID, Servicio_ID, Producto_ID, Cantidad,
        Precio_Unitario, Subtotal, Estado_Detalle,
        Servicio:Servicio(Nombre, Duracion_minutos),
        Producto:Producto(Nombre)
      )
    `)
    .order("Fecha_Venta", { ascending: false })
    .limit(100);

  if (filtros.fechaDesde) {
    query = query.gte("Fecha_Venta", `${filtros.fechaDesde}T00:00:00`);
  }
  if (filtros.fechaHasta) {
    query = query.lte("Fecha_Venta", `${filtros.fechaHasta}T23:59:59`);
  }
  if (filtros.clienteId) {
    query = query.eq("Cliente_ID", filtros.clienteId);
  }
  if (filtros.estado) {
    query = query.eq("Estado_Venta", filtros.estado);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((raw: Record<string, unknown>) => {
    const cliente = raw.Cliente as ClienteRaw | null;
    const usuario = raw.Usuario as UsuarioRaw | null;
    const detallesRaw = (raw.detalles ?? []) as Venta_DetalleRaw[];

    return {
      ...mapVenta(raw),
      Cliente: cliente ? mapCliente(cliente) : null,
      Usuario: usuario ? mapUsuario(usuario) : null,
      detalles: detallesRaw.map(mapVenta_Detalle),
    } as VentaConDetalle;
  });
}

/**
 * Obtiene una venta por su ID
 */
export async function obtenerVentaPorId(id: string): Promise<VentaConDetalle> {
  const { data, error } = await supabase
    .from("Venta")
    .select(`
      *,
      Cliente:Cliente(ID, Nombre, Apellido, Telefono),
      Usuario:Usuario(ID, Nombre, Apellido),
      detalles:Venta_Detalle(
        ID, Venta_ID, Servicio_ID, Producto_ID, Cantidad,
        Precio_Unitario, Subtotal, Estado_Detalle,
        Servicio:Servicio(Nombre, Duracion_minutos),
        Producto:Producto(Nombre)
      )
    `)
    .eq("ID", id)
    .single();

  if (error) throw new Error(error.message);

  const raw = data as Record<string, unknown>;
  const cliente = raw.Cliente as ClienteRaw | null;
  const usuario = raw.Usuario as UsuarioRaw | null;
  const detallesRaw = (raw.detalles ?? []) as Venta_DetalleRaw[];

  return {
    ...mapVenta(raw),
    Cliente: cliente ? mapCliente(cliente) : null,
    Usuario: usuario ? mapUsuario(usuario) : null,
    detalles: detallesRaw.map(mapVenta_Detalle),
  };
}

function toVentaCita(venta: VentaConDetalle): VentaCita {
  const metodosPago: MetodoPago[] = ["efectivo", "tarjeta", "transferencia", "yape", "plin"];
  const metodoPago = String(venta.Metodo_Pago ?? "").toLowerCase();

  return {
    id: String(venta.ID),
    citaId: String(venta.Cita_ID ?? ""),
    clienteNombre: `${venta.Cliente?.Nombre ?? ""} ${venta.Cliente?.Apellido ?? ""}`.trim(),
    servicios: venta.detalles
      .filter((detalle) => detalle.servicio_id)
      .map((detalle) => ({
        id: String(detalle.servicio_id),
        nombre: detalle.Servicio?.Nombre ?? "Servicio",
        precio: detalle.subtotal,
        duracion: detalle.Servicio?.Duracion_minutos ?? 0,
      })),
    productos: venta.detalles
      .filter((detalle) => detalle.producto_id)
      .map((detalle) => ({
        id: String(detalle.producto_id),
        nombre: detalle.Producto?.Nombre ?? "Producto",
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precio_unitario,
      })),
    metodoPago: metodosPago.includes(metodoPago as MetodoPago) ? (metodoPago as MetodoPago) : null,
    pagada: venta.Estado_Venta === "Pagado",
    total: Number(venta.Total ?? 0),
    fecha: String(venta.Fecha_Venta ?? ""),
  };
}

export async function obtenerVentasDeCitas(): Promise<VentaCita[]> {
  const ventas = await obtenerVentas();
  return ventas
    .filter((venta) => venta.Cita_ID)
    .map((venta) => toVentaCita(venta));
}

/** Obtiene la venta asociada a una cita. */
export async function obtenerVentaPorCita(citaId: string): Promise<VentaCita | null> {
  const venta = await obtenerVentaConDetallePorCita(citaId);
  return venta ? toVentaCita(venta) : null;
}

/** Añade un producto a la venta pendiente asociada a una cita. */
export async function agregarProductoVenta(
  citaId: string,
  productoId: string,
  cantidad: number,
): Promise<VentaCita> {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error("La cantidad debe ser un entero mayor que cero.");
  }

  const venta = await obtenerVentaConDetallePorCita(citaId);
  if (!venta) throw new Error("No existe una venta asociada a esta cita.");
  if (venta.Estado_Venta !== "Pendiente") throw new Error("Solo se pueden añadir productos a una venta pendiente.");

  const { data: producto, error: productoError } = await supabase
    .from("Producto")
    .select("Precio")
    .eq("ID", productoId)
    .single();
  if (productoError) throw new Error(productoError.message);

  const { error } = await supabase.from("Venta_Detalle").insert({
    Venta_ID: venta.ID,
    Servicio_ID: null,
    Producto_ID: productoId,
    Cantidad: cantidad,
    Precio_Unitario: Number(producto.Precio),
    Estado_Detalle: "Pendiente",
  });
  if (error) throw new Error(error.message);

  return toVentaCita(await obtenerVentaPorId(String(venta.ID)));
}

/** Registra el pago de la venta asociada a una cita. */
export async function registrarPago(
  citaId: string,
  metodoPago: MetodoPago,
  montoRecibido: number,
): Promise<VentaCita> {
  const venta = await obtenerVentaConDetallePorCita(citaId);
  if (!venta) throw new Error("No existe una venta asociada a esta cita.");
  if (!Number.isFinite(montoRecibido) || montoRecibido < Number(venta.Total)) {
    throw new Error("El importe recibido no cubre el total de la venta.");
  }
  if (venta.Estado_Venta !== "Pendiente") throw new Error("La venta no está pendiente de pago.");

  await pagarVenta(String(venta.ID));
  const { error } = await supabase
    .from("Venta")
    .update({ Metodo_Pago: metodoPago })
    .eq("ID", venta.ID);
  if (error) throw new Error(error.message);

  return toVentaCita(await obtenerVentaPorId(String(venta.ID)));
}

async function obtenerVentaConDetallePorCita(citaId: string): Promise<VentaConDetalle | null> {
  const { data, error } = await supabase
    .from("Venta")
    .select("ID")
    .eq("Cita_ID", citaId)
    .order("Fecha_Venta", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? obtenerVentaPorId(String(data.ID)) : null;
}

/**
 * Crea una venta con sus detalles
 */
export async function crearVenta(payload: CrearVentaPayload): Promise<VentaConDetalle> {
  // 1. Crear la venta (Total se calcula automaticamente por trigger)
  const { data: ventaData, error: ventaError } = await supabase
    .from("Venta")
    .insert({
      Cliente_ID: payload.Cliente_ID,
      Usuario_ID: payload.Usuario_ID,
      Cita_ID: payload.Cita_ID || null,
      Metodo_Pago: payload.Metodo_Pago || null,
      Estado_Venta: "Pendiente",
      Total: 0,
    })
    .select("ID")
    .single();

  if (ventaError) throw new Error(ventaError.message);
  const ventaId = (ventaData as { ID: number }).ID;

  // 2. Insertar detalles de servicios
  if (payload.servicios && payload.servicios.length > 0) {
    const detallesServicios = payload.servicios.map(s => ({
      Venta_ID: ventaId,
      Servicio_ID: s.Servicio_ID,
      Producto_ID: null,
      Cantidad: s.Cantidad,
      Precio_Unitario: s.Precio_Unitario,
      Estado_Detalle: "Pendiente",
    }));

    const { error } = await supabase.from("Venta_Detalle").insert(detallesServicios);
    if (error) throw new Error(error.message);
  }

  // 3. Insertar detalles de productos
  if (payload.productos && payload.productos.length > 0) {
    const detallesProductos = payload.productos.map(p => ({
      Venta_ID: ventaId,
      Servicio_ID: null,
      Producto_ID: p.Producto_ID,
      Cantidad: p.Cantidad,
      Precio_Unitario: p.Precio_Unitario,
      Estado_Detalle: "Pendiente",
    }));

    const { error } = await supabase.from("Venta_Detalle").insert(detallesProductos);
    if (error) throw new Error(error.message);
  }

  // 4. Devolver la venta completa
  return obtenerVentaPorId(String(ventaId));
}

/**
 * Actualiza el estado de una venta (marcar como Pagado)
 */
export async function pagarVenta(id: string): Promise<void> {
  // El trigger recalculara el Total automaticamente
  const { error } = await supabase
    .from("Venta_Detalle")
    .update({ Estado_Detalle: "Pagado" })
    .eq("Venta_ID", id);

  if (error) throw new Error(error.message);
}

/**
 * Cancela una venta
 */
export async function cancelarVenta(id: string): Promise<void> {
  // Actualizar todos los detalles a Cancelado
  const { error } = await supabase
    .from("Venta_Detalle")
    .update({ Estado_Detalle: "Cancelado" })
    .eq("Venta_ID", id);

  if (error) throw new Error(error.message);
}

/**
 * Elimina una venta (borrado fisico - usar con cuidado)
 */
export async function eliminarVenta(id: string): Promise<void> {
  const { error } = await supabase
    .from("Venta")
    .delete()
    .eq("ID", id);

  if (error) throw new Error(error.message);
}

// ==================== PROMICIONES ====================

/**
 * Obtiene todas las promociones activas
 */
export async function obtenerPromociones(): Promise<Promocion[]> {
  const { data, error } = await supabase
    .from("Promocion")
    .select("*")
    .eq("Estado", true)
    .lte("Fecha_Inicio", new Date().toISOString().split("T")[0])
    .gte("Fecha_Fin", new Date().toISOString().split("T")[0])
    .order("Nombre");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ID: String(row.ID ?? ""),
    Nombre: String(row.Nombre ?? ""),
    Descripcion: row.Descripcion ? String(row.Descripcion) : null,
    Porcentaje_Descuento: Number(row.Porcentaje_Descuento ?? 0),
    Fecha_Inicio: String(row.Fecha_Inicio ?? ""),
    Fecha_Fin: String(row.Fecha_Fin ?? ""),
    Servicio_ID: row.Servicio_ID ? String(row.Servicio_ID) : null,
    Estado: row.Estado !== false,
  }));
}

/**
 * Crea una promocion
 */
export async function crearPromocion(payload: {
  Nombre: string;
  Descripcion?: string;
  Porcentaje_Descuento: number;
  Fecha_Inicio: string;
  Fecha_Fin: string;
  Servicio_ID?: string;
}): Promise<Promocion> {
  const { data, error } = await supabase
    .from("Promocion")
    .insert({
      Nombre: payload.Nombre,
      Descripcion: payload.Descripcion || null,
      Porcentaje_Descuento: payload.Porcentaje_Descuento,
      Fecha_Inicio: payload.Fecha_Inicio,
      Fecha_Fin: payload.Fecha_Fin,
      Servicio_ID: payload.Servicio_ID || null,
      Estado: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    ID: String(data.ID),
    Nombre: data.Nombre,
    Descripcion: data.Descripcion,
    Porcentaje_Descuento: data.Porcentaje_Descuento,
    Fecha_Inicio: data.Fecha_Inicio,
    Fecha_Fin: data.Fecha_Fin,
    Servicio_ID: data.Servicio_ID,
    Estado: data.Estado,
  };
}