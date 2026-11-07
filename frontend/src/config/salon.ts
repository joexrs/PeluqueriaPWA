/** Datos del salón para tickets internos. Configurable con variables Vite. */
export const salon = {
  nombreComercial: import.meta.env.VITE_SALON_NOMBRE ?? "Victor Manuel Peluqueros",
  razonSocial:
    import.meta.env.VITE_SALON_RAZON_SOCIAL ?? "Víctor Manuel Peluquería & Estética S.A.C.",
  ruc: import.meta.env.VITE_SALON_RUC ?? "20608945123",
  direccion: import.meta.env.VITE_SALON_DIRECCION ?? "Av. Principal 123, Miraflores, Lima",
  telefono: import.meta.env.VITE_SALON_TELEFONO ?? "+51 999 888 777",
  web: import.meta.env.VITE_SALON_WEB ?? "www.victormanuelpeluqueros.com",
  logoUrl: "/LogoWM.png",
};

export function formatearMoneda(valor: number): string {
  const redondeado = Math.round((Number(valor) || 0) * 100) / 100;
  return redondeado.toFixed(2);
}

export function numeroTicket(ventaId: string): string {
  const numerico = ventaId.replace(/\D/g, "") || ventaId;
  return `TK-${numerico.padStart(6, "0")}`;
}
