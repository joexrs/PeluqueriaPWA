import type { Servicio } from "./types";
import { SERVICIOS_INICIALES } from "./mockData";

let servicios: Servicio[] = [...SERVICIOS_INICIALES];

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export async function obtenerServicios(): Promise<Servicio[]> {
  await esperar();
  return [...servicios];
}

export async function obtenerServicioPorId(id: string): Promise<Servicio | null> {
  await esperar();
  return servicios.find((servicio) => servicio.id === id) ?? null;
}

export async function crearServicio(data: Omit<Servicio, "id">): Promise<Servicio> {
  await esperar();

  const nuevoServicio: Servicio = {
    ...data,
    id: `s-${Date.now()}`,
  };

  servicios = [...servicios, nuevoServicio];
  return nuevoServicio;
}

export async function actualizarServicio(id: string, data: Partial<Omit<Servicio, "id">>): Promise<Servicio> {
  await esperar();

  const index = servicios.findIndex((servicio) => servicio.id === id);
  if (index === -1) {
    throw new Error("Servicio no encontrado.");
  }

  const actualizado = {
    ...servicios[index],
    ...data,
  };

  servicios = servicios.map((servicio) => (servicio.id === id ? actualizado : servicio));
  return actualizado;
}

export async function eliminarServicio(id: string): Promise<void> {
  await esperar();

  const existe = servicios.some((servicio) => servicio.id === id);
  if (!existe) {
    throw new Error("No se pudo eliminar: el servicio no existe.");
  }

  servicios = servicios.filter((servicio) => servicio.id !== id);
}
