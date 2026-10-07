import type { AuthError, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

export interface LoginResult {
  user: User | null;
  error: AuthError | null;
}

export async function iniciarSesion(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  return { user: data.user, error };
}
