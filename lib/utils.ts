import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind resolviendo conflictos (patrón de shadcn/ui) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}


/** Quita los parámetros vacíos de una URL (un filtro sin valor equivale a no filtrar) */
export function sinVacios(parametros: Iterable<[string, string | undefined]>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [clave, valor] of parametros) if (valor !== undefined && valor !== "") r[clave] = valor;
  return r;
}
