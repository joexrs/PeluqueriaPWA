import type { Promocion } from "./types";

export const PROMOCIONES_INICIALES: Promocion[] = [
  {
    id: "pr1",
    titulo: "Descuento de cumpleaños",
    descripcion: "20% de descuento en cualquier servicio el mes de tu cumpleaños.",
    descuento: 20,
    tipo: "cumpleaños",
    fechaInicio: "2026-01-01",
    fechaFin: "2026-12-31",
    activa: true,
  },
  {
    id: "pr2",
    titulo: "Fiestas patrias",
    descripcion: "15% en coloraciones y peinados del 15 al 20 de septiembre.",
    descuento: 15,
    tipo: "fiestas",
    fechaInicio: "2026-09-15",
    fechaFin: "2026-09-20",
    activa: true,
  },
  {
    id: "pr3",
    titulo: "Promo verano",
    descripcion: "10% en todos los servicios de tratamiento capilar en verano.",
    descuento: 10,
    tipo: "temporada",
    fechaInicio: "2026-12-01",
    fechaFin: "2027-02-28",
    activa: false,
  },
  {
    id: "pr4",
    titulo: "Primera visita",
    descripcion: "5% de descuento para clientes nuevos en cualquier servicio.",
    descuento: 5,
    tipo: "general",
    fechaInicio: "2026-01-01",
    fechaFin: "2026-12-31",
    activa: true,
  },
];
