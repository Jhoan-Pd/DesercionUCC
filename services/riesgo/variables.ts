/**
 * Variables del estudiante que se usan para estimar el riesgo de deserción.
 * Todas (menos el semestre) son opcionales: si el archivo de la universidad no trae un dato,
 * ese factor simplemente no se evalúa y queda listado como "dato faltante". Nunca se inventan valores.
 */
export interface DatosEstudiante {
  semestre: number;
  promedio?: number | null;
  materiasPerdidas?: number | null;
  asistencia?: number | null;
  estrato?: number | null;
  trabaja?: boolean | null;
  apoyoFinanciero?: boolean | null;
  moraMatricula?: boolean | null;
  puntajeSaber11?: number | null;
  edad?: number | null;
}

export type ClaveVariable = keyof DatosEstudiante;

/** Claves en el orden en que se muestran (tupla literal: la usa Zod para validar los modelos guardados) */
export const CLAVES_VARIABLES = ["semestre", "promedio", "materiasPerdidas", "asistencia", "estrato", "trabaja", "apoyoFinanciero", "moraMatricula", "puntajeSaber11", "edad"] as const satisfies readonly ClaveVariable[];

export interface DefinicionVariable {
  clave: ClaveVariable;
  etiqueta: string;
  tipo: "numero" | "booleano";
  /** Cómo mostrar el valor */
  formato: (v: number | boolean) => string;
}

const nota = (v: number | boolean) => Number(v).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const entero = (v: number | boolean) => Number(v).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const siNo = (v: number | boolean) => (v ? "Sí" : "No");

/**
 * Definición de cada variable, indexada por su clave. Al ser un Record<ClaveVariable, …>, TypeScript
 * exige una entrada por cada campo de DatosEstudiante: no se puede agregar una variable y olvidar su etiqueta.
 */
export const VARIABLE: Readonly<Record<ClaveVariable, DefinicionVariable>> = {
  semestre: { clave: "semestre", etiqueta: "Semestre", tipo: "numero", formato: entero },
  promedio: { clave: "promedio", etiqueta: "Promedio acumulado", tipo: "numero", formato: nota },
  materiasPerdidas: { clave: "materiasPerdidas", etiqueta: "Materias perdidas (último periodo)", tipo: "numero", formato: entero },
  asistencia: { clave: "asistencia", etiqueta: "Asistencia", tipo: "numero", formato: (v) => `${entero(v)} %` },
  estrato: { clave: "estrato", etiqueta: "Estrato", tipo: "numero", formato: entero },
  trabaja: { clave: "trabaja", etiqueta: "Trabaja", tipo: "booleano", formato: siNo },
  apoyoFinanciero: { clave: "apoyoFinanciero", etiqueta: "Beca, crédito o subsidio", tipo: "booleano", formato: siNo },
  moraMatricula: { clave: "moraMatricula", etiqueta: "Pagos de matrícula pendientes", tipo: "booleano", formato: siNo },
  puntajeSaber11: { clave: "puntajeSaber11", etiqueta: "Puntaje Saber 11", tipo: "numero", formato: entero },
  edad: { clave: "edad", etiqueta: "Edad", tipo: "numero", formato: entero },
};

/** Las mismas definiciones como lista, en el orden de CLAVES_VARIABLES */
export const VARIABLES: readonly DefinicionVariable[] = CLAVES_VARIABLES.map((clave) => VARIABLE[clave]);

export function tieneValor(v: unknown): v is number | boolean {
  return v !== null && v !== undefined && !(typeof v === "number" && Number.isNaN(v));
}

export function esClaveVariable(valor: unknown): valor is ClaveVariable {
  return typeof valor === "string" && Object.hasOwn(VARIABLE, valor);
}

/** Cualquier objeto que tenga las variables (p. ej. la fila de Prisma del estudiante) */
export type FuenteVariables = { [K in ClaveVariable]: DatosEstudiante[K] };

/** Extrae solo las variables del riesgo de un registro más grande (sin copiar nombre, código, etc.) */
export function datosDe(fuente: FuenteVariables): DatosEstudiante {
  return Object.fromEntries(CLAVES_VARIABLES.map((clave) => [clave, fuente[clave]])) as unknown as DatosEstudiante;
}

/** "Promedio acumulado: 2,8" */
export function describirValor(clave: ClaveVariable, valor: number | boolean): string {
  const def = VARIABLE[clave];
  return `${def.etiqueta}: ${def.formato(valor)}`;
}
