/**
 * Paleta de gráficas (validada con el método de dataviz).
 * Categóricos: se asignan en orden fijo por ENTIDAD (no por ranking).
 * Una sola serie usa el azul institucional UCC.
 */
export const COLOR = {
  ucc: "#00549F",
  uccClaro: "#8DB7DF",
  referencia: "#eb6834", // naranja: referencia nacional (siempre el mismo color para "Nacional")
  tinta: "#1b2430",
  /** Validada (CVD ΔE ≥ 23, piso visión normal ≥ 24). El naranja queda reservado para "referencia nacional". */
  categoria: {
    SOCIOECONOMICA: "#2a78d6",
    ACADEMICA: "#1baf7a",
    INDIVIDUAL: "#4a3aa7",
    INSTITUCIONAL: "#eda100",
  },
} as const;

/** Escala secuencial de un solo tono (azul) para ordenar cohortes de antigua (clara) a reciente (oscura) */
export function azulSecuencial(indice: number, total: number): string {
  const t = total <= 1 ? 1 : indice / (total - 1);
  const claro = [134, 178, 222];
  const oscuro = [0, 58, 112];
  const c = claro.map((v, i) => Math.round(v + (oscuro[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export const ETIQUETA_CATEGORIA: Record<string, string> = {
  SOCIOECONOMICA: "Socioeconómicas",
  ACADEMICA: "Académicas",
  INDIVIDUAL: "Individuales",
  INSTITUCIONAL: "Institucionales",
};
