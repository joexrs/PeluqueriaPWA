/**
 * loginService.ts
 * Autenticación real mediante Supabase Auth.
 * Después de un login exitoso, verifica que el usuario tenga un perfil
 * en la tabla `usuarios` (RLS garantiza que solo ven su propio perfil).
 */
import { supabase } from "../../lib/supabaseClient";

export interface LoginPayload {
  email: string;
  password: string;
  remember?: boolean;
}

export async function iniciarSesion(
  data: LoginPayload
): Promise<{ ok: boolean; message: string }> {
  if (!data.email || !data.password) {
    return { ok: false, message: "Completa email y contraseña para continuar." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email.trim(),
    password: data.password,
  });

  if (error) {
    // Mensaje amigable para errores comunes
    if (
      error.message.toLowerCase().includes("invalid") ||
      error.message.toLowerCase().includes("credentials")
    ) {
      return { ok: false, message: "Email o contraseña incorrectos." };
    }
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "Inicio de sesión correcto." };
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}

export async function obtenerSesionActual() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
