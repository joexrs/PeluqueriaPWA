/**
 * AuthContext.tsx
 * Contexto global de autenticación.
 * Provee el estado de sesión y perfil del usuario a toda la aplicación,
 * escuchando cambios en tiempo real desde Supabase Auth.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { RolUsuario } from "../pages/usuarios/usuariosService";

/* ── Tipos ─────────────────────────────────────────────── */

export interface PerfilUsuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

interface AuthState {
  /** Sesión de Supabase (null si no autenticado) */
  session: Session | null;
  /** Usuario de Supabase Auth */
  user: User | null;
  /** Perfil del usuario desde la tabla `usuarios` */
  perfil: PerfilUsuario | null;
  /** true mientras se verifica la sesión al cargar la app */
  cargando: boolean;
  /** Cerrar sesión y limpiar estado */
  cerrarSesion: () => Promise<void>;
  /** Refrescar el perfil del usuario manualmente */
  refrescarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/* ── Provider ──────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  /**
   * Obtiene el perfil del usuario actual desde la tabla `usuarios`
   * vinculado por `auth_id`. Si no existe o no tiene rol, asigna admin por defecto.
   */
  const cargarPerfil = useCallback(async (user: User) => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, apellido, email, rol, activo")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error al cargar perfil:", error.message);
        setPerfil(null);
        return;
      }

      if (data) {
        setPerfil({
          id: data.id,
          nombre: data.nombre || "Usuario",
          apellido: data.apellido || "Prueba",
          email: data.email,
          rol: (data.rol as RolUsuario) || "admin", // Fallback a admin si no hay rol
          activo: data.activo !== false, // Fallback a true
        });
      } else {
        // Fallback total para usuarios que aún no están en la tabla `usuarios` (ej. usuario de prueba)
        setPerfil({
          id: user.id,
          nombre: "Usuario",
          apellido: "Admin (Prueba)",
          email: user.email || "",
          rol: "admin",
          activo: true,
        });
      }
    } catch (err) {
      console.error("Error inesperado al cargar perfil:", err);
      setPerfil(null);
    }
  }, []);

  const refrescarPerfil = useCallback(async () => {
    if (session?.user) {
      await cargarPerfil(session.user);
    }
  }, [session, cargarPerfil]);

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPerfil(null);
  }, []);

  useEffect(() => {
    let montado = true;

    // 1. Obtener sesión actual al montar
    async function inicializar() {
      try {
        const {
          data: { session: sesionActual },
        } = await supabase.auth.getSession();

        if (!montado) return;

        setSession(sesionActual);

        if (sesionActual?.user) {
          await cargarPerfil(sesionActual.user);
        }
      } catch (err) {
        console.error("Error al inicializar sesión:", err);
      } finally {
        if (montado) setCargando(false);
      }
    }

    void inicializar();

    // 2. Escuchar cambios de sesión en tiempo real
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (evento, nuevaSesion) => {
      if (!montado) return;

      setSession(nuevaSesion);

      if (evento === "SIGNED_IN" && nuevaSesion?.user) {
        await cargarPerfil(nuevaSesion.user);
      }

      if (evento === "SIGNED_OUT") {
        setPerfil(null);
      }

      // Si el token se refresca, actualizamos la sesión
      if (evento === "TOKEN_REFRESHED") {
        setSession(nuevaSesion);
      }
    });

    return () => {
      montado = false;
      subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const valor: AuthState = {
    session,
    user: session?.user ?? null,
    perfil,
    cargando,
    cerrarSesion,
    refrescarPerfil,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/* ── Hook ──────────────────────────────────────────────── */

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
