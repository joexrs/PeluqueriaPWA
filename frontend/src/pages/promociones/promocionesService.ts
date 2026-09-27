import type { Promocion } from "./types";
import { PROMOCIONES_INICIALES } from "./mockData";

let promociones: Promocion[] = [...PROMOCIONES_INICIALES];

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export async function obtenerPromociones(): Promise<Promocion[]> {
  await esperar();
  return [...promociones];
}

export async function obtenerPromocionPorId(id: string): Promise<Promocion | null> {
  await esperar();
  return promociones.find((p) => p.id === id) ?? null;
}

export async function crearPromocion(data: Omit<Promocion, "id">): Promise<Promocion> {
  await esperar();

  const nuevaPromocion: Promocion = {
    ...data,
    id: `pr-${Date.now()}`,
  };

  promociones = [...promociones, nuevaPromocion];
  return nuevaPromocion;
}

export async function actualizarPromocion(
  id: string,
  data: Partial<Omit<Promocion, "id">>
): Promise<Promocion> {
  await esperar();

  const index = promociones.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error("Promoción no encontrada.");
  }

  const actualizada = {
    ...promociones[index],
    ...data,
  };

  promociones = promociones.map((p) => (p.id === id ? actualizada : p));
  return actualizada;
}

export async function eliminarPromocion(id: string): Promise<void> {
  await esperar();

  const existe = promociones.some((p) => p.id === id);
  if (!existe) {
    throw new Error("No se pudo eliminar: la promoción no existe.");
  }

  promociones = promociones.filter((p) => p.id !== id);
}

export async function toggleActivarPromocion(id: string): Promise<Promocion> {
  await esperar();

  const index = promociones.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error("Promoción no encontrada.");
  }

  const actualizada = { ...promociones[index], activa: !promociones[index].activa };
  promociones = promociones.map((p) => (p.id === id ? actualizada : p));
  return actualizada;
}
