import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind resolviendo conflictos (patrón de shadcn/ui) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const formatoPesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** $ 1.234.567 */
export function formatoCOP(valor: number): string {
  return formatoPesos.format(Math.round(valor));
}

/** Formato compacto para ejes y tarjetas: $1,2 M / $1.200 M / $350 mil */
export function formatoCOPCompacto(valor: number): string {
  const abs = Math.abs(valor);
  const signo = valor < 0 ? "-" : "";
  // Millones también por encima de mil millones ("$1.200 M"): más corto y legible en los ejes
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: abs >= 100_000_000 ? 0 : 1 })} M`;
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000).toLocaleString("es-CO")} mil`;
  return `${signo}$${Math.round(abs)}`;
}

export function formatoPct(valor: number, decimales = 1): string {
  return `${valor.toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}%`;
}

export function formatoNumero(valor: number): string {
  return valor.toLocaleString("es-CO");
}
