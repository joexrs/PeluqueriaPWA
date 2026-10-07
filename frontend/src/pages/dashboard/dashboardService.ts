/**
 * dashboardService.ts
 * Agrega datos de múltiples tablas para construir el resumen del dashboard.
 *
 * Consultas realizadas en paralelo para minimizar latencia:
 *   1. KPIs: citas de hoy, ventas del día, alertas de inventario, pendientes
 *   2. Próximas citas del día (ordenadas por hora_inicio)
 *   3. Ventas de los últimos 7 días (para el gráfico semanal)
 */

import { supabase } from "../../lib/supabaseClient";
import type { DashboardData, ProximaCita, VentaSemana } from "./types";

const DIAS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function hoy(): string {
  return new Date().toISOString().split("T")[0];
}

function restarDias(diasAtras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().split("T")[0];
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

async function fetchKpis() {
  const fechaHoy = hoy();

  const [citasHoyRes, ventasHoyRes, productosRes, pendientesRes] =
    await Promise.all([
      supabase
        .from("Cita")
        .select("ID", { count: "exact", head: true })
        .eq("fecha_cita", fechaHoy)
        .eq("Estado", true),

      supabase
        .from("Venta")
        .select("Total")
        .gte("Fecha_Venta", `${fechaHoy}T00:00:00`)
        .lte("Fecha_Venta", `${fechaHoy}T23:59:59`),

      supabase
        .from("Producto")
        .select("Stock_total")
        .eq("Estado", true),

      supabase
        .from("Cita")
        .select("ID", { count: "exact", head: true })
        .eq("Estado", true),
    ]);

  if (citasHoyRes.error) throw new Error(citasHoyRes.error.message);
  if (ventasHoyRes.error) throw new Error(ventasHoyRes.error.message);
  if (productosRes.error) throw new Error(productosRes.error.message);
  if (pendientesRes.error) throw new Error(pendientesRes.error.message);

  const citasHoy = citasHoyRes.count ?? 0;

  const ventasHoy = (ventasHoyRes.data ?? []).reduce(
    (sum: number, venta: { Total: number }) => sum + Number(venta.Total ?? 0),
    0
  );

  const alertasInventario = (productosRes.data ?? []).filter(
    (producto: { Stock_total: number }) => Number(producto.Stock_total) <= 0
  ).length;

  const citasPorConfirmar = pendientesRes.count ?? 0;

  return { citasHoy, ventasHoy, alertasInventario, citasPorConfirmar };
}

// ─── Próximas citas ───────────────────────────────────────────────────────────

async function fetchProximasCitas(): Promise<ProximaCita[]> {
  const fechaHoy = hoy();

  const { data, error } = await supabase
    .from("Cita")
    .select(`
      ID,
      hora_inicio,
      Estado,
      Cliente:Cliente!FK_Cita_Cliente ( Nombre, Apellido ),
      servicios:Cita_Servicio!FK_CitaServ_Cita (
        Servicio:Servicio!FK_CitaServ_Servicio ( Nombre ),
        Trabajador:Trabajador_Servicio!FK_CitaServ_Trabajador_Servicio (
          Usuario:Usuario!FK_TrabajadorServicio_Usuario ( Nombre, Apellido, Color_agenda )
        )
      )
    `)
    .eq("fecha_cita", fechaHoy)
    .eq("Estado", true)
    .order("hora_inicio", { ascending: true })
    .limit(8);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const cliente = row.Cliente as {
      Nombre: string;
      Apellido: string | null;
    } | null;
    const servicios = (row.servicios as Array<{
      Servicio: { Nombre: string } | null;
      Trabajador: {
        Usuario: {
          Nombre: string;
          Apellido: string;
          Color_agenda: string | null;
        } | null;
      } | null;
    }>) ?? [];
    const trabajador = servicios[0]?.Trabajador?.Usuario ?? null;

    const serviciosResumen = servicios
      .map((servicio) => servicio.Servicio?.Nombre ?? "")
      .filter(Boolean)
      .join(", ") || "Sin servicios";

    return {
      id: String(row.ID),
      hora_inicio: row.hora_inicio as string,
      cliente_nombre: cliente?.Nombre ?? "Cliente",
      cliente_apellido: cliente?.Apellido ?? null,
      trabajador_nombre: trabajador?.Nombre ?? null,
      trabajador_apellido: trabajador?.Apellido ?? null,
      trabajador_color: trabajador?.Color_agenda ?? null,
      servicios_resumen: serviciosResumen,
      estado: row.Estado === true ? "PENDIENTE" : "CANCELADA",
    };
  });
}

// ─── Ventas semanales ─────────────────────────────────────────────────────────

async function fetchVentasSemana(): Promise<VentaSemana[]> {
  // Últimos 7 días
  const fechaDesde = restarDias(6);
  const fechaHasta = hoy();

  const { data, error } = await supabase
    .from("Venta")
    .select("Fecha_Venta, Total")
    .gte("Fecha_Venta", `${fechaDesde}T00:00:00`)
    .lte("Fecha_Venta", `${fechaHasta}T23:59:59`);

  if (error) throw new Error(error.message);

  // Agrupar por día
  const mapaVentas: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    mapaVentas[restarDias(i)] = 0;
  }

  (data ?? []).forEach((venta: { Fecha_Venta: string; Total: number }) => {
    const fecha = venta.Fecha_Venta.slice(0, 10);
    if (mapaVentas[fecha] !== undefined) {
      mapaVentas[fecha] += Number(venta.Total ?? 0);
    }
  });

  return Object.entries(mapaVentas).map(([fecha, total]) => {
    const d = new Date(fecha + "T12:00:00"); // mediodía para evitar offset
    return { dia: DIAS_ES[d.getDay()], fecha, total };
  });
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function obtenerDashboardData(): Promise<DashboardData> {
  const [kpis, proximasCitas, ventasSemana] = await Promise.all([
    fetchKpis(),
    fetchProximasCitas(),
    fetchVentasSemana(),
  ]);

  return { kpis, proximasCitas, ventasSemana };
}
