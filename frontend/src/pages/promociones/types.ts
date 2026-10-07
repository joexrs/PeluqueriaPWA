export interface Promocion {
  id: string;
  titulo: string;
  descripcion: string;
  descuento: number;
  servicioId: string;
  servicioNombre: string | null;
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
}
