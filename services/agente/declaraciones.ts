import type { DeclaracionFuncion } from "@/lib/ia/gemini";
import { NIVELES } from "@/services/riesgo/niveles";

/**
 * Herramientas (function calling) que el agente puede usar para consultar la información REAL del sistema.
 * Ninguna devuelve nombres, documentos ni datos de contacto: los estudiantes se identifican por código.
 */
export const DECLARACIONES = [
  {
    name: "resumen_riesgo",
    description: "Resumen de los estudiantes activos cargados: cuántos hay, cuántos en riesgo alto, medio y bajo, por programa, factores más frecuentes y método de cálculo vigente.",
  },
  {
    name: "buscar_estudiantes",
    description: "Busca estudiantes activos por nivel de riesgo, programa, semestre máximo o factor de riesgo. Devuelve código, programa, semestre, puntaje, nivel y factores, ordenados del mayor al menor riesgo.",
    parameters: {
      type: "OBJECT",
      properties: {
        nivel: { type: "STRING", enum: [...NIVELES], description: "Nivel de riesgo" },
        programa: { type: "STRING", description: "Nombre (o parte del nombre) del programa académico" },
        semestre_maximo: { type: "INTEGER", description: "Solo estudiantes hasta este semestre" },
        factor: { type: "STRING", description: "Texto del factor de riesgo, p. ej. 'promedio', 'asistencia', 'matrícula'" },
        limite: { type: "INTEGER", description: "Máximo de estudiantes a devolver (1 a 50, por defecto 15)" },
      },
    },
  },
  {
    name: "detalle_estudiante",
    description: "Datos académicos y socioeconómicos de un estudiante (sin nombre) y su evaluación de riesgo con los factores.",
    parameters: { type: "OBJECT", properties: { codigo: { type: "STRING", description: "Código del estudiante" } }, required: ["codigo"] },
  },
  {
    name: "cifras_oficiales_ucc",
    description:
      "Cifras oficiales y agregadas del Ministerio de Educación (datos.gov.co) para la UCC: matrícula de la sede Pasto por año (2015-2021), por programa y sexo, total nacional de la UCC por año, matrícula por sede y programas activos en Pasto. No contiene datos de estudiantes individuales ni tasas de deserción.",
  },
] as const satisfies readonly DeclaracionFuncion[];

/** Nombres de las herramientas, tomados de las declaraciones (un nombre nuevo obliga a implementarlo) */
export type NombreHerramienta = (typeof DECLARACIONES)[number]["name"];

export function esNombreHerramienta(nombre: string): nombre is NombreHerramienta {
  return DECLARACIONES.some((d) => d.name === nombre);
}

/**
 * Lo que el agente necesita de sus herramientas: qué describirle a Gemini y cómo ejecutar cada una.
 * Declaración y ejecución viajan juntas, así un doble de prueba no puede anunciar herramientas que no ejecuta.
 */
export interface Herramientas {
  readonly declaraciones: readonly DeclaracionFuncion[];
  ejecutar(nombre: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
}
