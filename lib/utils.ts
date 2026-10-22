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

/** Guarda el resultado de una función de un argumento para no recalcularlo con el mismo valor */
export function memorizar<A, R>(fn: (a: A) => R): (a: A) => R {
  const cache = new Map<A, R>();
  return (a) => {
    if (!cache.has(a)) cache.set(a, fn(a));
    return cache.get(a) as R;
  };
}

/**
 * Decodifica un segmento de la URL (p. ej. el código de un estudiante). Si el texto no es una
 * secuencia válida (un "%" suelto), decodeURIComponent lanza URIError y la ruta respondía 500;
 * aquí se devuelve el texto tal cual y la validación posterior decide.
 */
export function decodificarSegmento(segmento: string): string {
  try {
    return decodeURIComponent(segmento);
  } catch {
    return segmento;
  }
}
