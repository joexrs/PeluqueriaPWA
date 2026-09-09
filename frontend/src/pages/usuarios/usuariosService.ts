import type { Usuario } from "./types";
import { USUARIOS_INICIALES } from "./mockData";

let usuarios: Usuario[] = [...USUARIOS_INICIALES];

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export async function obtenerUsuarios(): Promise<Usuario[]> {
  await esperar();
  return [...usuarios];
}

export async function crearUsuario(data: Omit<Usuario, "id">): Promise<Usuario> {
  await esperar();

  const nuevoUsuario: Usuario = {
    ...data,
    id: `u-${Date.now()}`,
  };

  usuarios = [...usuarios, nuevoUsuario];
  return nuevoUsuario;
}

export async function actualizarUsuario(id: string, data: Partial<Omit<Usuario, "id">>): Promise<Usuario> {
  await esperar();

  const index = usuarios.findIndex((usuario) => usuario.id === id);
  if (index === -1) throw new Error("Usuario no encontrado.");

  const actualizado = { ...usuarios[index], ...data };
  usuarios = usuarios.map((usuario) => (usuario.id === id ? actualizado : usuario));
  return actualizado;
}

export async function eliminarUsuario(id: string): Promise<void> {
  await esperar();

  const existe = usuarios.some((usuario) => usuario.id === id);
  if (!existe) throw new Error("No se pudo eliminar: el usuario no existe.");

  usuarios = usuarios.filter((usuario) => usuario.id !== id);
}
