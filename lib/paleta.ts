/**
 * Paleta del diseño editorial: única fuente de los colores. La usan tailwind.config.ts (clases como
 * `text-tinta` o `bg-riesgo-alto-fondo`) y los componentes que necesitan el valor hexadecimal
 * (gráficas de Recharts, barras dibujadas con `style` y la plantilla de Excel).
 */
import type { NivelRiesgo } from "@/services/riesgo/niveles";

export const PALETA = {
  // Neutros
  tinta: "#303030",
  grafito: "#505050",
  piedra: "#6E6E6E",
  papel: "#F9F9F9",
  // Acentos apagados, reservados para datos y estados
  petroleo: "#2B7983",
  pino: "#234F46",
  salvia: "#84A98C",
  marino: "#234F65",
  coral: "#D91642",
  // Fondos pastel para etiquetas y avisos
  bruma: "#DCE6ED",
  niebla: "#EEF3F6",
  hoja: "#E7EDE8",
  agua: "#C8DBD7",
  // Niveles de riesgo (fondo, texto y borde), siempre acompañados de texto e ícono
  riesgo: {
    "alto-fondo": "#F7E1E6",
    alto: "#9E1235",
    "alto-borde": "#EDC2CC",
    "medio-fondo": "#F4EBD9",
    medio: "#7A5410",
    "medio-borde": "#E5D2AA",
    "bajo-fondo": "#E7EDE8",
    bajo: "#234F46",
    "bajo-borde": "#C8DBD7",
  },
} as const;

/** Colores de los niveles en gráficas y barras (salvia, ocre y coral apagado) */
export const COLOR_NIVEL: Readonly<Record<NivelRiesgo, string>> = { BAJO: "#5E8C6A", MEDIO: "#B07D1E", ALTO: "#C2264E" };

/** Gráficas: una sola serie en petróleo; al resaltar una barra, el resto va en verde agua */
export const COLOR_GRAFICA = { serie: PALETA.petroleo, contexto: PALETA.agua } as const;
