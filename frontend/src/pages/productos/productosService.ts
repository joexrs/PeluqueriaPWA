/**
 * productosService.ts
 * Acceso directo a la BD real: productos, categorías, proveedores y movimientos.
 */

import { supabase } from "../../lib/supabaseClient";
import type {
  ProductoConLotes,
  MovimientoConProducto,
  CrearProductoPayload,
  RegistrarEntradaPayload,
  RegistrarSalidaPayload,
  FiltroProductos,
  FiltroMovimientos,
} from "./types";

export interface CategoriaProductoRow {
  id: string;
  nombre: string;
}

export interface ProveedorRow {
  id: string;
  razon_social: string;
}

const PRODUCTO_SELECT = `
  *,
  categoria:categorias_productos ( id, nombre ),
  proveedor:proveedores ( id, razon_social ),
  lotes:lotes_producto ( * )
` as const;

const MOVIMIENTO_SELECT = `
  *,
  producto:productos ( nombre, marca ),
  lote:lotes_producto ( numero_lote ),
  usuario:usuarios ( nombre, apellido )
` as const;

function proxCaducidad(lotes: Array<{ fecha_caducidad: string | null; stock_actual: number }>): string | null {
  const futuras = lotes
    .filter((l) => l.stock_actual > 0 && l.fecha_caducidad)
    .map((l) => l.fecha_caducidad as string)
    .sort();
  return futuras[0] ?? null;
}

export async function obtenerCategoriasProductos(): Promise<CategoriaProductoRow[]> {
  const { data, error } = await supabase
    .from("categorias_productos")
    .select("*")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaProductoRow[];
}

export async function obtenerProveedores(): Promise<ProveedorRow[]> {
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, razon_social")
    .eq("activo", true)
    .order("razon_social");

  if (error) throw new Error(error.message);
  return (data ?? []) as ProveedorRow[];
}

export async function obtenerProductos(
  filtros: FiltroProductos = {}
): Promise<ProductoConLotes[]> {
  let query = supabase
    .from("productos")
    .select(PRODUCTO_SELECT)
    .order("nombre", { ascending: true });

  if (filtros.soloActivos !== false) {
    query = query.eq("activo", true);
  }
  if (filtros.categoriaId) {
    query = query.eq("categoria_id", filtros.categoriaId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let resultados = (data ?? []) as unknown as ProductoConLotes[];

  if (filtros.busqueda) {
    const q = filtros.busqueda.toLowerCase();
    resultados = resultados.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        (p.codigo_barras ?? "").toLowerCase().includes(q)
    );
  }

  if (filtros.soloStockBajo) {
    resultados = resultados.filter((p) => p.stock_total <= p.stock_minimo);
  }

  return resultados.map((p) => ({
    ...p,
    proximo_a_vencer: proxCaducidad(p.lotes ?? []),
  }));
}

export async function obtenerProductoPorId(id: string): Promise<ProductoConLotes> {
  const { data, error } = await supabase
    .from("productos")
    .select(PRODUCTO_SELECT)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  const p = data as unknown as ProductoConLotes;
  return { ...p, proximo_a_vencer: proxCaducidad(p.lotes ?? []) };
}

export async function crearProducto(payload: CrearProductoPayload): Promise<ProductoConLotes> {
  const { data, error } = await supabase
    .from("productos")
    .insert({
      nombre: payload.nombre,
      marca: payload.marca,
      categoria_id: payload.categoria_id ?? null,
      proveedor_id: payload.proveedor_id ?? null,
      codigo_barras: payload.codigo_barras ?? null,
      unidad_medida: payload.unidad_medida ?? "UNIDAD",
      stock_minimo: payload.stock_minimo ?? 5,
      precio_venta_publico: payload.precio_venta_publico,
    })
    .select(PRODUCTO_SELECT)
    .single();

  if (error) throw new Error(error.message);
  const p = data as unknown as ProductoConLotes;
  return { ...p, proximo_a_vencer: proxCaducidad(p.lotes ?? []) };
}

export async function actualizarProducto(
  id: string,
  cambios: Partial<CrearProductoPayload>
): Promise<ProductoConLotes> {
  const { error } = await supabase.from("productos").update(cambios).eq("id", id);
  if (error) throw new Error(error.message);
  return obtenerProductoPorId(id);
}

export async function desactivarProducto(id: string): Promise<void> {
  const { error } = await supabase
    .from("productos")
    .update({ activo: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function registrarEntrada(
  payload: RegistrarEntradaPayload,
  usuarioId?: string
): Promise<void> {
  const { data: loteData, error: loteError } = await supabase
    .from("lotes_producto")
    .insert({
      producto_id: payload.producto_id,
      numero_lote: payload.numero_lote,
      costo_unitario: payload.costo_unitario,
      cantidad_inicial: payload.cantidad,
      stock_actual: payload.cantidad,
      fecha_caducidad: payload.fecha_caducidad ?? null,
    })
    .select("id")
    .single();

  if (loteError) throw new Error(loteError.message);

  const loteId = (loteData as { id: string }).id;

  const { error: movError } = await supabase.from("movimientos_inventario").insert({
    lote_id: loteId,
    producto_id: payload.producto_id,
    usuario_id: usuarioId ?? null,
    tipo_movimiento: "ENTRADA_COMPRA",
    cantidad: payload.cantidad,
    motivo: payload.motivo ?? `Entrada de lote ${payload.numero_lote}`,
  });

  if (movError) throw new Error(movError.message);
}

export async function registrarSalida(payload: RegistrarSalidaPayload): Promise<void> {
  const { data: lote, error: loteError } = await supabase
    .from("lotes_producto")
    .select("stock_actual")
    .eq("id", payload.lote_id)
    .single();

  if (loteError) throw new Error(loteError.message);

  const stockActual = (lote as { stock_actual: number }).stock_actual;
  if (payload.cantidad > stockActual) {
    throw new Error(
      `Stock insuficiente en el lote. Disponible: ${stockActual}, solicitado: ${payload.cantidad}.`
    );
  }

  const { error: updateError } = await supabase
    .from("lotes_producto")
    .update({ stock_actual: stockActual - payload.cantidad })
    .eq("id", payload.lote_id);

  if (updateError) throw new Error(updateError.message);

  const { error: movError } = await supabase.from("movimientos_inventario").insert({
    lote_id: payload.lote_id,
    producto_id: payload.producto_id,
    usuario_id: payload.usuario_id ?? null,
    tipo_movimiento: payload.tipo,
    cantidad: payload.cantidad,
    motivo: payload.motivo,
  });

  if (movError) throw new Error(movError.message);
}

export async function obtenerMovimientos(
  filtros: FiltroMovimientos = {}
): Promise<MovimientoConProducto[]> {
  let query = supabase
    .from("movimientos_inventario")
    .select(MOVIMIENTO_SELECT)
    .order("fecha_movimiento", { ascending: false })
    .limit(200);

  if (filtros.productoId) query = query.eq("producto_id", filtros.productoId);
  if (filtros.loteId) query = query.eq("lote_id", filtros.loteId);
  if (filtros.tipo) query = query.eq("tipo_movimiento", filtros.tipo);
  if (filtros.fechaDesde) query = query.gte("fecha_movimiento", filtros.fechaDesde);
  if (filtros.fechaHasta) query = query.lte("fecha_movimiento", filtros.fechaHasta);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []) as MovimientoConProducto[];
}

export async function contarAlertasInventario(): Promise<number> {
  const { data, error } = await supabase
    .from("productos")
    .select("id, stock_total, stock_minimo")
    .eq("activo", true);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(
    (p: { stock_total: number; stock_minimo: number }) => p.stock_total <= p.stock_minimo
  ).length;
}
