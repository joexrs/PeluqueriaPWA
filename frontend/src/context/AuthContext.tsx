/**
 * AuthContext.tsx
 * Supabase Auth session and the linked application profile/role.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { iniciarSesion as autenticar } from "../pages/login/loginService";
import type { RolUsuario } from "../pages/usuarios/usuariosService";

export interface PerfilUsuario {
  ID: number;
  DNI: string | null;
  Nombre: string;
  Apellido: string;
  E_mail: string;
  Telefono: string | null;
  Usuario: string;
  Color_agenda: string | null;
  Comision_porcentaje: number | null;
  Rol_id: number | null;
  Estado: boolean;
  auth_user_id: string;
  Rol:
    | {
        ID: number;
        Nombre: string;
        Estado: boolean;
      }
    | {
        ID: number;
        Nombre: string;
        Estado: boolean;
      }[]
    | null;
}

interface AuthState {
  user: User | null;
  profile: PerfilUsuario | null;
  role: RolUsuario | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  session: Session | null;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PerfilUsuario | null>(null);
  const [role, setRole] = useState<RolUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadProfile = useCallback(async (authUser: User) => {
    const currentRequest = ++requestId.current;
    setUser(authUser);
    setProfile(null);
    setRole(null);
    setProfileError(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("Usuario")
      .select(`
        ID,
        DNI,
        Nombre,
        Apellido,
        E_mail,
        Telefono,
        Usuario,
        Color_agenda,
        Comision_porcentaje,
        Rol_id,
        Estado,
        auth_user_id,
        Rol (
          ID,
          Nombre,
          Estado
        )
      `)
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (currentRequest !== requestId.current) return;

    if (error) {
      console.error("No se pudo cargar el perfil asociado a Auth:", error.message);
      setProfileError(
        error.code === "PGRST116"
          ? "Hay más de un perfil de Usuario vinculado a esta cuenta. Debe existir una sola fila con este auth_user_id."
          : `No se pudo cargar tu perfil y rol desde Supabase: ${error.message}`,
      );
      setLoading(false);
      return;
    }

    if (!data) {
      setProfileError(
        "No se encontró un perfil de Usuario visible para esta sesión. Comprueba que public.Usuario.auth_user_id coincida exactamente con el UUID de Supabase Auth y que RLS permita leer ese perfil.",
      );
      setLoading(false);
      return;
    }

    const loadedProfile = data as PerfilUsuario;
    const roleRow = Array.isArray(loadedProfile.Rol)
      ? loadedProfile.Rol[0]
      : loadedProfile.Rol;
    const loadedRole = roleRow?.Nombre?.toLowerCase();
    const validRoles: RolUsuario[] = ["admin", "jefe", "recepcionista", "trabajador"];

    if (
      loadedProfile.auth_user_id !== authUser.id ||
      loadedProfile.Estado !== true ||
      !roleRow ||
      !loadedRole ||
      !validRoles.includes(loadedRole as RolUsuario) ||
      roleRow.Estado !== true
    ) {
      setProfileError("El usuario no tiene un perfil activo con un rol válido vinculado en Supabase.");
      setLoading(false);
      return;
    }

    setProfile(loadedProfile);
    setRole(loadedRole as RolUsuario);
    setLoading(false);
  }, []);

  const syncSession = useCallback(async (nextSession: Session | null) => {
    const currentRequest = ++requestId.current;
    setSession(nextSession);
    setProfile(null);
    setRole(null);
    setProfileError(null);

    if (!nextSession) {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser(nextSession.user);
    setLoading(true);

    const { data, error } = await supabase.auth.getUser();
    if (currentRequest !== requestId.current) return;

    if (error || !data.user || data.user.id !== nextSession.user.id) {
      console.error("No se pudo verificar el usuario de la sesión:", error?.message);
      setProfileError(error?.message ?? "No se pudo verificar la sesión de Supabase.");
      setLoading(false);
      return;
    }

    await loadProfile(data.user);
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await autenticar(email, password);
    if (result.error || !result.user) {
      return {
        ok: false,
        message: result.error?.message ?? "No se pudo iniciar sesión.",
      };
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || data.session.user.id !== result.user.id) {
      return {
        ok: false,
        message: error?.message ?? "Supabase no devolvió una sesión válida.",
      };
    }

    await syncSession(data.session);
    return { ok: true, message: "Inicio de sesión correcto." };
  }, [syncSession]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("No se pudo cerrar la sesión de Supabase:", error.message);
      throw error;
    }

    requestId.current += 1;
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setProfileError(null);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [loadProfile, user]);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      window.setTimeout(() => {
        if (mounted) void syncSession(nextSession);
      }, 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("No se pudo recuperar la sesión de Supabase:", error.message);
        setProfileError(error.message);
        setLoading(false);
        return;
      }
      void syncSession(data.session);
    }).catch((error: unknown) => {
      if (!mounted) return;
      console.error("Error inesperado al recuperar la sesión:", error);
      setProfileError("No se pudo recuperar la sesión de Supabase.");
      setLoading(false);
    });

    return () => {
      mounted = false;
      requestId.current += 1;
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const value: AuthState = {
    user,
    profile,
    role,
    loading,
    profileError,
    signIn,
    signOut,
    refreshProfile,
    session,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// This hook is exported alongside the provider as part of the context API.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return context;
}
