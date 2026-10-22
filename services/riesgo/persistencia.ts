import type { FactorRiesgo } from "./factores";
import { esClaveVariable, type ClaveVariable } from "./variables";

/**
 * Lectura de lo que se guarda en la tabla de evaluaciones (columnas JSON y texto[]).
 * La base de datos no conoce estos tipos, así que aquí se convierten en tipos del dominio,
 * descartando lo que no tenga la forma esperada en lugar de confiar en un `as`.
 */

function esFactor(valor: unknown): valor is FactorRiesgo {
  if (!valor || typeof valor !== "object") return false;
  const f = valor as Record<string, unknown>;
  return typeof f.clave === "string" && typeof f.etiqueta === "string" && typeof f.puntos === "number" && typeof f.detalle === "string";
}

/** Factores guardados en la columna JSON `factores` */
export function factoresDe(json: unknown): FactorRiesgo[] {
  return Array.isArray(json) ? json.filter(esFactor) : [];
}

/** Variables faltantes guardadas en la columna `faltantes` (texto[]) */
export function faltantesDe(valores: readonly string[] | null | undefined): ClaveVariable[] {
  return (valores ?? []).filter(esClaveVariable);
}
