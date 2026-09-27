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
        .from("citas")
        .select("id", { count: "exact", head: true })
        .eq("fecha", fechaHoy)
        .neq("estado", "CANCELADA"),

      supabase
        .from("ventas")
        .select("monto_total")
        .gte("created_at", `${fechaHoy}T00:00:00`)
        .lte("created_at", `${fechaHoy}T23:59:59`),

      supabase
        .from("productos")
        .select("stock_total, stock_minimo")
        .eq("activo", true),

      supabase
        .from("citas")
        .select("id", { count: "exact", head: true })
        .eq("estado", "PENDIENTE"),
    ]);

  const citasHoy = citasHoyRes.count ?? 0;

  const ventasHoy = (ventasHoyRes.data ?? []).reduce(
    (sum: number, v: { monto_total: number }) => sum + v.monto_total,
    0
  );

  const alertasInventario = (productosRes.data ?? []).filter(
    (p: { stock_total: number; stock_minimo: number }) =>
      p.stock_total <= p.stock_minimo
  ).length;

  const citasPorConfirmar = pendientesRes.count ?? 0;

  return { citasHoy, ventasHoy, alertasInventario, citasPorConfirmar };
}

// ─── Próximas citas ───────────────────────────────────────────────────────────

async function fetchProximasCitas(): Promise<ProximaCita[]> {
  const fechaHoy = hoy();

  const { data, error } = await supabase
    .from("citas")
    .select(`
      id,
      hora_inicio,
      estado,
      cliente:clientes ( nombre, apellido ),
      trabajador:usuarios!citas_trabajador_id_fkey ( nombre, apellido, color_agenda ),
      servicios:detalle_citas_servicios (
        servicio:servicios ( nombre )
      )
    `)
    .eq("fecha", fechaHoy)
    .neq("estado", "CANCELADA")
    .neq("estado", "COMPLETADA")
    .order("hora_inicio", { ascending: true })
    .limit(8);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const cliente = row.cliente as { nombre: string; apellido: string | null } | null;
    const trabajador = row.trabajador as {
      nombre: string; apellido: string; color_agenda: string;
    } | null;
    const servicios = (row.servicios as Array<{ servicio: { nombre: string } | null }>) ?? [];

    const serviciosResumen = servicios
      .map((s) => s.servicio?.nombre ?? "")
      .filter(Boolean)
      .join(", ") || "Sin servicios";

    return {
      id: row.id as string,
      hora_inicio: row.hora_inicio as string,
      cliente_nombre: cliente?.nombre ?? "Cliente",
      cliente_apellido: cliente?.apellido ?? null,
      trabajador_nombre: trabajador?.nombre ?? null,
      trabajador_apellido: trabajador?.apellido ?? null,
      trabajador_color: trabajador?.color_agenda ?? null,
      servicios_resumen: serviciosResumen,
      estado: row.estado as string,
    };
  });
}

// ─── Ventas semanales ─────────────────────────────────────────────────────────

async function fetchVentasSemana(): Promise<VentaSemana[]> {
  // Últimos 7 días
  const fechaDesde = restarDias(6);
  const fechaHasta = hoy();

  const { data, error } = await supabase
    .from("ventas")
    .select("created_at, monto_total")
    .gte("created_at", `${fechaDesde}T00:00:00`)
    .lte("created_at", `${fechaHasta}T23:59:59`);

  if (error) throw new Error(error.message);

  // Agrupar por día
  const mapaVentas: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    mapaVentas[restarDias(i)] = 0;
  }

  (data ?? []).forEach((v: { created_at: string; monto_total: number }) => {
    const fecha = v.created_at.slice(0, 10);
    if (mapaVentas[fecha] !== undefined) {
      mapaVentas[fecha] += v.monto_total;
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
