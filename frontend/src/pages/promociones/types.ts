export type TipoPromocion = "cumpleaños" | "fiestas" | "temporada" | "general";

export interface Promocion {
  id: string;
  titulo: string;
  descripcion: string;
  descuento: number; // porcentaje (0-100)
  tipo: TipoPromocion;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  activa: boolean;
}
