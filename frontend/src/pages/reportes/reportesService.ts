import { supabase } from "../../lib/supabaseClient";
import type { ReporteVentas, CuadreCaja, ComisionTrabajador } from "./types";

interface UsuarioComisionRaw {
  Nombre: string | null;
  Apellido: string | null;
  Comision_porcentaje: number | string | null;
}

interface ServicioComisionRaw {
  Cantidad: number | string | null;
  trabajador_id: number | string | null;
  Servicio: RelacionRaw<{ Precio: number | string | null }>;
  Trabajador: RelacionRaw<{ Usuario: RelacionRaw<UsuarioComisionRaw> }>;
}

interface CitaComisionRaw {
  servicios: ServicioComisionRaw[] | null;
}

type RelacionRaw<T> = T | T[] | null;

function primeraRelacion<T>(relacion: RelacionRaw<T> | undefined): T | null {
  return Array.isArray(relacion) ? relacion[0] ?? null : relacion ?? null;
}

export async function obtenerReporteVentas(
  fechaInicio: string,
  fechaFin: string
): Promise<ReporteVentas> {
  // Obtener ventas del período
  const { data: ventas, error: ventasError } = await supabase
    .from("Venta")
    .select(`
      ID,
      Total,
      Estado_Venta,
      detalles:Venta_Detalle(
        Servicio_ID,
        Producto_ID,
        Cantidad,
        Precio_Unitario,
        Subtotal,
        Estado_Detalle,
        Servicio:Servicio(ID, Nombre),
        Producto:Producto(ID, Nombre)
      )
    `)
    .eq("Estado_Venta", "Pagado")
    .gte("Fecha_Venta", `${fechaInicio}T00:00:00`)
    .lte("Fecha_Venta", `${fechaFin}T23:59:59`);

  if (ventasError) throw new Error(ventasError.message);

  // Procesar datos
  let totalVentas = 0;
  let totalServicios = 0;
  let totalProductos = 0;
  const serviciosMap = new Map<string, { nombre: string; cantidad: number; total: number }>();
  const productosMap = new Map<string, { nombre: string; cantidad: number; total: number }>();

  (ventas || []).forEach((venta: any) => {
    totalVentas += Number(venta.Total || 0);

    (venta.detalles || []).forEach((detalle: any) => {
      if (detalle.Estado_Detalle === "Cancelado") return;

      const subtotal = Number(detalle.Subtotal || 0);
      const cantidad = Number(detalle.Cantidad || 1);

      if (detalle.Servicio_ID && detalle.Servicio) {
        totalServicios += subtotal;
        const id = String(detalle.Servicio_ID);
        const actual = serviciosMap.get(id) || { nombre: detalle.Servicio.Nombre, cantidad: 0, total: 0 };
        serviciosMap.set(id, {
          nombre: actual.nombre,
          cantidad: actual.cantidad + 1,
          total: actual.total + subtotal,
        });
      }

      if (detalle.Producto_ID && detalle.Producto) {
        totalProductos += subtotal;
        const id = String(detalle.Producto_ID);
        const actual = productosMap.get(id) || { nombre: detalle.Producto.Nombre, cantidad: 0, total: 0 };
        productosMap.set(id, {
          nombre: actual.nombre,
          cantidad: actual.cantidad + cantidad,
          total: actual.total + subtotal,
        });
      }
    });
  });

  // Convertir a arrays y ordenar
  const serviciosMasVendidos = Array.from(serviciosMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const productosMasVendidos = Array.from(productosMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    totalVentas,
    totalServicios,
    totalProductos,
    cantidadVentas: ventas?.length || 0,
    ticketPromedio: ventas?.length ? totalVentas / ventas.length : 0,
    serviciosMasVendidos,
    productosMasVendidos,
  };
}

export async function obtenerCuadreCaja(
  fechaInicio: string,
  fechaFin: string
): Promise<CuadreCaja> {
  const { data, error } = await supabase
    .from("Venta")
    .select("Total, Metodo_Pago")
    .eq("Estado_Venta", "Pagado")
    .gte("Fecha_Venta", `${fechaInicio}T00:00:00`)
    .lte("Fecha_Venta", `${fechaFin}T23:59:59`);

  if (error) throw new Error(error.message);

  const cuadre: CuadreCaja = {
    efectivo: 0,
    yape: 0,
    plin: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
  };

  (data || []).forEach((venta: any) => {
    const total = Number(venta.Total || 0);
    const metodo = String(venta.Metodo_Pago || "").toLowerCase();

    cuadre.total += total;

    switch (metodo) {
      case "efectivo":
        cuadre.efectivo += total;
        break;
      case "yape":
        cuadre.yape += total;
        break;
      case "plin":
        cuadre.plin += total;
        break;
      case "tarjeta":
        cuadre.tarjeta += total;
        break;
      case "transferencia":
        cuadre.transferencia += total;
        break;
    }
  });

  return cuadre;
}

export async function obtenerComisionesTrabajadores(
  fechaInicio: string,
  fechaFin: string
): Promise<ComisionTrabajador[]> {
  // El trabajador está asignado por servicio, no directamente en la cita.
  const { data: citas, error } = await supabase
    .from("Cita")
    .select(`
      ID,
      servicios:Cita_Servicio!inner(
        Cantidad,
        trabajador_id,
        Servicio:Servicio!FK_CitaServ_Servicio(Precio),
        Trabajador:Trabajador_Servicio!FK_CitaServ_Trabajador_Servicio(
          Usuario:Usuario!FK_TrabajadorServicio_Usuario(ID, Nombre, Apellido, Comision_porcentaje)
        )
      )
    `)
    .eq("Estado_Cita", "COMPLETADA")
    .gte("fecha_cita", fechaInicio)
    .lte("fecha_cita", fechaFin);

  if (error) throw new Error(error.message);

  const trabajadoresMap = new Map<
    string,
    {
      nombre: string;
      cantidadServicios: number;
      totalServicios: number;
      porcentajeComision: number;
    }
  >();

  ((citas || []) as CitaComisionRaw[]).forEach((cita) => {
    (cita.servicios || []).forEach((servicio) => {
      const usuario = primeraRelacion(primeraRelacion(servicio.Trabajador)?.Usuario);
      if (!usuario || !servicio.trabajador_id) return;

      const id = String(servicio.trabajador_id);
      const cantidad = Number(servicio.Cantidad || 1);
      const servicioInfo = primeraRelacion(servicio.Servicio);
      const actual = trabajadoresMap.get(id) || {
        nombre: `${usuario.Nombre} ${usuario.Apellido}`.trim(),
        cantidadServicios: 0,
        totalServicios: 0,
        porcentajeComision: Number(usuario.Comision_porcentaje || 0),
      };

      actual.cantidadServicios += cantidad;
      actual.totalServicios += Number(servicioInfo?.Precio || 0) * cantidad;
      trabajadoresMap.set(id, actual);
    });
  });

  return Array.from(trabajadoresMap.entries())
    .map(([id, data]) => ({
      id,
      ...data,
      montoComision: (data.totalServicios * data.porcentajeComision) / 100,
    }))
    .sort((a, b) => b.totalServicios - a.totalServicios);
}
