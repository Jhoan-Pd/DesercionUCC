/**
 * Niveles de riesgo: la lista, su orden de gravedad y sus nombres para mostrar.
 * Módulo sin dependencias: lo usan el cálculo del riesgo, los validadores, el agente y los
 * componentes del navegador, en lugar de repetir "ALTO" | "MEDIO" | "BAJO" en cada uno.
 */
export const NIVELES = ["ALTO", "MEDIO", "BAJO"] as const;
export type NivelRiesgo = (typeof NIVELES)[number];

export const ETIQUETA_NIVEL: Readonly<Record<NivelRiesgo, string>> = { ALTO: "Alto", MEDIO: "Medio", BAJO: "Bajo" };

export function esNivel(valor: unknown): valor is NivelRiesgo {
  return typeof valor === "string" && (NIVELES as readonly string[]).includes(valor);
}

/** Nivel según dos umbrales (sirve igual para el puntaje 0-100 y para la probabilidad del modelo) */
export function nivelSegunUmbrales(valor: number, umbrales: { medio: number; alto: number }): NivelRiesgo {
  if (valor >= umbrales.alto) return "ALTO";
  if (valor >= umbrales.medio) return "MEDIO";
  return "BAJO";
}
