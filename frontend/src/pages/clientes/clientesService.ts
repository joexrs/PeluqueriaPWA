import type { Cliente } from "./types";
import { CLIENTES_INICIALES } from "./mockData";

let clientes: Cliente[] = [...CLIENTES_INICIALES];

async function esperar(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export async function obtenerClientes(): Promise<Cliente[]> {
  await esperar();
  return [...clientes];
}

export async function obtenerClientePorId(id: string): Promise<Cliente | null> {
  await esperar();
  return clientes.find((cliente) => cliente.id === id) ?? null;
}

export async function crearCliente(data: Omit<Cliente, "id">): Promise<Cliente> {
  await esperar();

  const nuevoCliente: Cliente = {
    ...data,
    id: `c-${Date.now()}`,
  };

  clientes = [...clientes, nuevoCliente];
  return nuevoCliente;
}

export async function actualizarCliente(id: string, data: Partial<Omit<Cliente, "id">>): Promise<Cliente> {
  await esperar();

  const index = clientes.findIndex((cliente) => cliente.id === id);
  if (index === -1) {
    throw new Error("Cliente no encontrado.");
  }

  const actualizado = {
    ...clientes[index],
    ...data,
  };

  clientes = clientes.map((cliente) => (cliente.id === id ? actualizado : cliente));
  return actualizado;
}

export async function eliminarCliente(id: string): Promise<void> {
  await esperar();

  const existe = clientes.some((cliente) => cliente.id === id);
  if (!existe) {
    throw new Error("No se pudo eliminar: el cliente no existe.");
  }

  clientes = clientes.filter((cliente) => cliente.id !== id);
}
