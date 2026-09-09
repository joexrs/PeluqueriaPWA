import type { CitaAgenda, Especialista } from "./types";
import { CITAS_INICIALES } from "./mockData";

const citas: CitaAgenda[] = [...CITAS_INICIALES];

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export async function obtenerCitas(): Promise<CitaAgenda[]> {
  await esperar();
  return citas.map((cita) => ({ ...cita }));
}

export async function obtenerCitasPorFiltro(params: {
  day?: number;
  staff?: Especialista;
  services?: string[];
}): Promise<CitaAgenda[]> {
  await esperar();

  return citas.filter((cita) => {
    const matchesDay = params.day ? cita.day === params.day : true;
    const matchesStaff = params.staff && params.staff !== "Todos" ? cita.staff === params.staff : true;
    const matchesService = params.services && params.services.length > 0 ? params.services.includes(cita.category) : true;
    return matchesDay && matchesStaff && matchesService;
  });
}
