import { supabase } from "../../lib/supabaseClient";
import type { CitaConsultaPublica } from "./types";

export async function consultarCitasPorDNI(dni: string): Promise<CitaConsultaPublica[]> {
  const dniLimpio = dni.trim().replace(/[^0-9a-zA-Z]/g, "");
  if (!dniLimpio || dniLimpio.length < 4) {
    throw new Error("Ingresa un número de documento válido (mínimo 4 caracteres).");
  }

  const { data, error } = await supabase.rpc("consultar_citas_por_dni", {
    p_dni: dniLimpio,
  });

  if (error) {
    throw new Error("No se pudo consultar las citas en este momento. Por favor, intenta nuevamente.");
  }

  return (data ?? []) as CitaConsultaPublica[];
}

