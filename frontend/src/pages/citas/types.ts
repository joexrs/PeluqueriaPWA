export type CategoriaCita = "hair" | "nails" | "skin";
export type Especialista = "Todos" | "Elena" | "Carlos" | "Dra. Soto";

export interface CitaAgenda {
  id: string;
  day: number;
  title: string;
  staff: Exclude<Especialista, "Todos">;
  category: CategoriaCita;
  time: string;
  client: string;
  top: number;
  left: number;
}
