/**
 * productosService.ts — acceso directo a las tablas de inventario segun schema.sql
 */
import { supabase } from "../../lib/supabaseClient";
import type {
  Producto,
  ProductoConLotes,
  CategoriaProducto,
  Lote,
  Movimiento,
  CrearProductoPayload,
  CrearLotePayload,
  CrearMovimientoPayload,
  RegistrarEntradaPayload,
  RegistrarSalidaPayload,
  FiltroProductos,
  FiltroMovimientos
} from "./types";

// Interfaces Raw de Supabase
interface CategoriaRaw {
  ID: unknown;
  Nombre: unknown;
  Estado: unknown;
  Created_at: unknown;
}

interface ProductoRaw {
  ID: unknown;
  Nombre: unknown;
  Descripcion: unknown;
  Marca: unknown;
  Codigo: unknown;
  Precio: unknown;
  Stock_total: unknown;
  Categoria_id: unknown;
  Estado: unknown;
  Created_at: unknown;
  Updated_at: unknown;
  Categoria: unknown;
}

interface LoteRaw {
  ID: unknown;
  Fecha_vencimiento: unknown;
  Fecha_ingreso: unknown;
  Cantidad: unknown;
  Producto_id: unknown;
  Estado: unknown;
}

interface MovimientoRaw {
  ID: unknown;
  Cantidad: unknown;
  Tipo: unknown;
  Fecha_movimiento: unknown;
  Lote_id: unknown;
  Producto_id: unknown;
  Estado: unknown;
}

/**
 * Mapea una fila cruda de Categoria
 */
function mapCategoria(row: CategoriaRaw): CategoriaProducto {
  return {
    ID: String(row.ID ?? ""),
    Nombre: String(row.Nombre ?? ""),
    Estado: row.Estado !== false,
    Created_at: row.Created_at ? String(row.Created_at) : undefined,
    id: String(row.ID ?? ""),
    nombre: String(row.Nombre ?? ""),
  };
}

/**
 * Mapea una fila cruda de Producto
 */
function mapProducto(raw: ProductoRaw): ProductoConLotes {
  const cat = raw.Categoria as CategoriaRaw | null;
  return {
    ID: String(raw.ID ?? ""),
    Nombre: String(raw.Nombre ?? ""),
    Descripcion: raw.Descripcion ? String(raw.Descripcion) : null,
    Marca: raw.Marca ? String(raw.Marca) : null,
    Codigo: raw.Codigo ? String(raw.Codigo) : null,
    Precio: Number(raw.Precio ?? 0),
    Stock_total: Number(raw.Stock_total ?? 0),
    Categoria_id: raw.Categoria_id ? String(raw.Categoria_id) : null,
    Estado: raw.Estado !== false,
    Created_at: raw.Created_at ? String(raw.Created_at) : undefined,
    Updated_at: raw.Updated_at ? String(raw.Updated_at) : undefined,
    Categoria: cat ? mapCategoria(cat) : null,
    id: String(raw.ID ?? ""),
    nombre: String(raw.Nombre ?? ""),
    marca: raw.Marca ? String(raw.Marca) : "",
    codigo_barras: raw.Codigo ? String(raw.Codigo) : null,
    stock_total: Number(raw.Stock_total ?? 0),
    stock_minimo: 0,
    precio_venta_publico: Number(raw.Precio ?? 0),
    categoria: cat ? mapCategoria(cat) : null,
    lotes: [],
  };
}

/**
 * Mapea una fila cruda de Lote
 */
function mapLote(row: LoteRaw): Lote {
  return {
    ID: String(row.ID ?? ""),
    id: String(row.ID ?? ""),
    Fecha_vencimiento: row.Fecha_vencimiento ? String(row.Fecha_vencimiento) : "",
    Fecha_ingreso: row.Fecha_ingreso ? String(row.Fecha_ingreso) : "",
    Cantidad: Number(row.Cantidad ?? 0),
    Producto_id: String(row.Producto_id ?? ""),
    Estado: row.Estado !== false,
    fecha_caducidad: row.Fecha_vencimiento ? String(row.Fecha_vencimiento) : null,
    stock_actual: Number(row.Cantidad ?? 0),
  };
}

/**
 * Mapea una fila cruda de Movimiento
 */
function mapMovimiento(row: MovimientoRaw): Movimiento {
  return {
    ID: String(row.ID ?? ""),
    Cantidad: Number(row.Cantidad ?? 0),
    Tipo: row.Tipo === "Entrada" ? "Entrada" : "Salida",
    Fecha_movimiento: row.Fecha_movimiento ? String(row.Fecha_movimiento) : "",
    Lote_id: String(row.Lote_id ?? ""),
    Producto_id: String(row.Producto_id ?? ""),
    Estado: row.Estado !== false,
  };
}

// ==================== CATEGORIAS ====================

/**
 * Obtiene todas las categorias de productos
 */
export async function obtenerCategoriasProductos(): Promise<CategoriaProducto[]> {
  const { data, error } = await supabase
    .from("Categoria")
    .select("*")
    .eq("Estado", true)
    .order("Nombre");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCategoria);
}

// ==================== PRODUCTOS ====================

/**
 * Obtiene todos los productos con filtros
 */
export async function obtenerProductos(filtros: FiltroProductos = {}): Promise<ProductoConLotes[]> {
  let query = supabase
    .from("Producto")
    .select("*, Categoria(*)")
    .order("Nombre");

  if (filtros.soloActivos !== false) {
    query = query.eq("Estado", true);
  }
  if (filtros.categoriaId) {
    query = query.eq("Categoria_id", filtros.categoriaId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let resultados = (data ?? []).map(mapProducto);

  // Filtrar por busqueda en memoria (PostgREST no soporta busqueda en JSON anidado)
  if (filtros.busqueda) {
    const q = filtros.busqueda.toLowerCase();
    resultados = resultados.filter(
      p => p.Nombre.toLowerCase().includes(q) ||
           (p.Marca?.toLowerCase().includes(q)) ||
           (p.Codigo?.toLowerCase().includes(q))
    );
  }

  if (resultados.length === 0) return resultados;

  const { data: lotesData, error: lotesError } = await supabase
    .from("Lote")
    .select("*")
    .in("Producto_id", resultados.map((producto) => producto.ID))
    .eq("Estado", true)
    .order("Fecha_vencimiento", { ascending: true });
  if (lotesError) throw new Error(lotesError.message);

  const lotesPorProducto = new Map<string, Lote[]>();
  for (const raw of (lotesData ?? []) as LoteRaw[]) {
    const lote = mapLote(raw);
    const existentes = lotesPorProducto.get(lote.Producto_id) ?? [];
    existentes.push(lote);
    lotesPorProducto.set(lote.Producto_id, existentes);
  }

  return resultados.map((producto) => {
    const lotes = lotesPorProducto.get(producto.ID) ?? [];
    const proximoVencimiento = lotes.find((lote) => Number(lote.Cantidad) > 0)?.Fecha_vencimiento ?? null;
    return {
      ...producto,
      lotes,
      proximo_a_vencer: proximoVencimiento,
    };
  });
}

/**
 * Obtiene un producto por su ID
 */
export async function obtenerProductoPorId(id: string): Promise<ProductoConLotes> {
  const { data, error } = await supabase
    .from("Producto")
    .select("*, Categoria(*)")
    .eq("ID", id)
    .single();

  if (error) throw new Error(error.message);
  return mapProducto(data as ProductoRaw);
}

/**
 * Crea un nuevo producto
 */
export async function crearProducto(payload: CrearProductoPayload): Promise<ProductoConLotes> {
  const nombre = payload.Nombre ?? payload.nombre;
  const precio = payload.Precio ?? payload.precio_venta_publico;
  if (!nombre || precio === undefined) {
    throw new Error("Nombre y precio del producto son obligatorios.");
  }

  const { data, error } = await supabase
    .from("Producto")
    .insert({
      Nombre: nombre,
      Descripcion: payload.Descripcion || null,
      Marca: payload.Marca ?? payload.marca ?? null,
      Codigo: payload.Codigo ?? payload.codigo_barras ?? null,
      Precio: precio,
      Stock_total: 0,
      Categoria_id: payload.Categoria_id ?? payload.categoria_id ?? null,
      Estado: true,
    })
    .select("*, Categoria(*)")
    .single();

  if (error) throw new Error(error.message);
  return mapProducto(data as ProductoRaw);
}

/**
 * Actualiza un producto existente
 */
export async function actualizarProducto(
  id: string,
  cambios: Partial<CrearProductoPayload>
): Promise<Producto> {
  const updateData: Record<string, unknown> = {};

  if (cambios.Nombre !== undefined || cambios.nombre !== undefined) {
    updateData.Nombre = cambios.Nombre ?? cambios.nombre;
  }
  if (cambios.Descripcion !== undefined) updateData.Descripcion = cambios.Descripcion || null;
  if (cambios.Marca !== undefined || cambios.marca !== undefined) {
    updateData.Marca = cambios.Marca ?? cambios.marca ?? null;
  }
  if (cambios.Codigo !== undefined || cambios.codigo_barras !== undefined) {
    updateData.Codigo = cambios.Codigo ?? cambios.codigo_barras ?? null;
  }
  if (cambios.Precio !== undefined || cambios.precio_venta_publico !== undefined) {
    updateData.Precio = cambios.Precio ?? cambios.precio_venta_publico;
  }
  if (cambios.Categoria_id !== undefined || cambios.categoria_id !== undefined) {
    updateData.Categoria_id = cambios.Categoria_id ?? cambios.categoria_id ?? null;
  }

  const { data, error } = await supabase
    .from("Producto")
    .update(updateData)
    .eq("ID", id)
    .select("*, Categoria(*)")
    .single();

  if (error) throw new Error(error.message);
  return mapProducto(data as ProductoRaw);
}

/**
 * Desactiva un producto (borrado logico)
 */
export async function eliminarProducto(id: string): Promise<void> {
  const { error } = await supabase
    .from("Producto")
    .update({ Estado: false })
    .eq("ID", id);

  if (error) throw new Error(error.message);
}

// ==================== LOTES ====================

/**
 * Obtiene los lotes de un producto
 */
export async function obtenerLotesProducto(productoId: string): Promise<Lote[]> {
  const { data, error } = await supabase
    .from("Lote")
    .select("*")
    .eq("Producto_id", productoId)
    .eq("Estado", true)
    .gte("Cantidad", 0)
    .order("Fecha_vencimiento", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLote);
}

// ==================== MOVIMIENTOS ====================

/**
 * Registra una entrada de inventario (crea lote + movimiento)
 */
export async function registrarEntrada(
  payload: CrearLotePayload | RegistrarEntradaPayload
): Promise<Lote> {
  const productoId = "Producto_id" in payload ? payload.Producto_id : payload.producto_id;
  const cantidad = "Cantidad" in payload ? payload.Cantidad : payload.cantidad;
  const fechaVencimiento = "Fecha_vencimiento" in payload
    ? payload.Fecha_vencimiento
    : payload.fecha_caducidad;

  if (!productoId || !cantidad || cantidad <= 0 || !fechaVencimiento) {
    throw new Error("Producto, cantidad y fecha de caducidad son obligatorios para registrar la entrada.");
  }

  // 1. Crear el lote
  const { data: loteData, error: loteError } = await supabase
    .from("Lote")
    .insert({
      Fecha_vencimiento: fechaVencimiento,
      Fecha_ingreso: new Date().toISOString().split("T")[0],
      Cantidad: cantidad,
      Producto_id: productoId,
      Estado: true,
    })
    .select()
    .single();

  if (loteError) throw new Error(loteError.message);

  // 2. Registrar movimiento de entrada
  const { error: movError } = await supabase
    .from("Movimientos")
    .insert({
      Cantidad: cantidad,
      Tipo: "Entrada",
      Lote_id: (loteData as { ID: number }).ID,
      Producto_id: productoId,
      Estado: true,
    });

  if (movError) {
    await supabase.from("Lote").delete().eq("ID", (loteData as { ID: number }).ID);
    throw new Error(movError.message);
  }

  // 3. Actualizar stock total del producto
  const producto = await obtenerProductoPorId(productoId);
  const { error: stockError } = await supabase
    .from("Producto")
    .update({ Stock_total: producto.Stock_total + cantidad })
    .eq("ID", productoId);
  if (stockError) throw new Error(stockError.message);

  return mapLote(loteData as LoteRaw);
}

/**
 * Registra una salida de inventario
 */
export async function registrarSalida(
  payload: CrearMovimientoPayload | RegistrarSalidaPayload
): Promise<void> {
  const productoId = "Producto_id" in payload ? payload.Producto_id : payload.producto_id;
  const cantidad = "Cantidad" in payload ? payload.Cantidad : payload.cantidad;
  if (!productoId || !cantidad || cantidad <= 0) {
    throw new Error("Producto y cantidad válida son obligatorios para registrar la salida.");
  }

  // Obtener lotes disponibles del producto (ordenados por fecha de vencimiento)
  const { data: lotes, error: loteError } = await supabase
    .from("Lote")
    .select("*")
    .eq("Producto_id", productoId)
    .eq("Estado", true)
    .gt("Cantidad", 0)
    .order("Fecha_vencimiento", { ascending: true });

  if (loteError) throw new Error(loteError.message);
  if (!lotes || lotes.length === 0) throw new Error("No hay stock disponible");

  // Sacar del lote mas antiguo (FIFO)
  const loteSolicitado = "lote_id" in payload ? payload.lote_id : undefined;
  const loteDisponible = loteSolicitado
    ? lotes.find((lote) => String((lote as { ID: number }).ID) === loteSolicitado)
    : lotes[0];
  if (!loteDisponible) throw new Error("El lote seleccionado no tiene stock disponible.");
  const loteElegido = loteDisponible as { ID: number; Cantidad: number };

  if (cantidad > loteElegido.Cantidad) {
    throw new Error("La cantidad solicitada supera el stock disponible en el lote.");
  }
  const cantidadASacar = cantidad;

  // Actualizar cantidad del lote
  const { error: updateError } = await supabase
    .from("Lote")
    .update({ Cantidad: loteElegido.Cantidad - cantidadASacar })
    .eq("ID", loteElegido.ID);

  if (updateError) throw new Error(updateError.message);

  // Registrar movimiento de salida
  const { error: movError } = await supabase
    .from("Movimientos")
    .insert({
      Cantidad: cantidadASacar,
      Tipo: "Salida",
      Lote_id: loteElegido.ID,
      Producto_id: productoId,
      Estado: true,
    });

  if (movError) throw new Error(movError.message);

  // Actualizar stock total del producto
  const producto = await obtenerProductoPorId(productoId);
  const { error: stockError } = await supabase
    .from("Producto")
    .update({ Stock_total: producto.Stock_total - cantidadASacar })
    .eq("ID", productoId);
  if (stockError) throw new Error(stockError.message);
}

/**
 * Obtiene movimientos de inventario
 */
export async function obtenerMovimientos(filtros: FiltroMovimientos = {}): Promise<Movimiento[]> {
  let query = supabase
    .from("Movimientos")
    .select("*")
    .order("Fecha_movimiento", { ascending: false })
    .limit(200);

  if (filtros.productoId) query = query.eq("Producto_id", filtros.productoId);
  if (filtros.tipo) query = query.eq("Tipo", filtros.tipo);
  if (filtros.fechaDesde) query = query.gte("Fecha_movimiento", filtros.fechaDesde);
  if (filtros.fechaHasta) query = query.lte("Fecha_movimiento", filtros.fechaHasta);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMovimiento);
}
// ==================== EXPORTS DE COMPATIBILIDAD ====================
export type CategoriaProductoRow = CategoriaProducto;

export function toProductoRow(producto: Producto): ProductoConLotes {
  return {
    ...producto,
    id: producto.ID || "",
    nombre: producto.Nombre,
    marca: producto.Marca || "",
    stock: producto.Stock_total,
    stockMin: 0,
    tipo: producto.Categoria?.Nombre || "",
    caducidad: null,
    lotes: [],
    proximo_a_vencer: null,
  } as unknown as ProductoConLotes;
}
