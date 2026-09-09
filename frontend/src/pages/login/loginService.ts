import type { LoginPayload } from "./types";

const CREDENCIALES_DEMO: LoginPayload = {
  email: "manager@peluqueria.com",
  password: "password123",
  remember: true,
};

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
}

export async function iniciarSesion(data: LoginPayload): Promise<{ ok: boolean; message: string }> {
  await esperar();

  if (!data.email || !data.password) {
    return { ok: false, message: "Completa email y contraseña para continuar." };
  }

  const coincideEmail = data.email.trim().toLowerCase() === CREDENCIALES_DEMO.email.toLowerCase();
  const coincidePassword = data.password === CREDENCIALES_DEMO.password;

  if (!coincideEmail || !coincidePassword) {
    return { ok: false, message: "Credenciales incorrectas. Usa las credenciales demo del proyecto." };
  }

  return { ok: true, message: "Inicio de sesión correcto." };
}
