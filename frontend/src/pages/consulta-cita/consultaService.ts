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
    console.error("Error al consultar citas por DNI:", error);
    if (error.code === "PGRST202") {
      throw new Error(
        "La consulta por DNI aún no está habilitada en la base de datos. Aplica las migraciones de Supabase e inténtalo nuevamente.",
      );
    }
    if (error.code === "42804") {
      throw new Error(
        "La consulta por DNI necesita una corrección en la base de datos. Aplica la migración 20261107123000_corregir_tipo_consulta_citas.sql.",
      );
    }
    throw new Error("No se pudo consultar las citas en este momento. Por favor, intenta nuevamente.");
  }

  return (data ?? []) as CitaConsultaPublica[];
}
