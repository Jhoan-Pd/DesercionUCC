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

export const VARIABLES: DefinicionVariable[] = [
  { clave: "semestre", etiqueta: "Semestre", tipo: "numero", formato: entero },
  { clave: "promedio", etiqueta: "Promedio acumulado", tipo: "numero", formato: nota },
  { clave: "materiasPerdidas", etiqueta: "Materias perdidas (último periodo)", tipo: "numero", formato: entero },
  { clave: "asistencia", etiqueta: "Asistencia", tipo: "numero", formato: (v) => `${entero(v)} %` },
  { clave: "estrato", etiqueta: "Estrato", tipo: "numero", formato: entero },
  { clave: "trabaja", etiqueta: "Trabaja", tipo: "booleano", formato: siNo },
  { clave: "apoyoFinanciero", etiqueta: "Beca, crédito o subsidio", tipo: "booleano", formato: siNo },
  { clave: "moraMatricula", etiqueta: "Pagos de matrícula pendientes", tipo: "booleano", formato: siNo },
  { clave: "puntajeSaber11", etiqueta: "Puntaje Saber 11", tipo: "numero", formato: entero },
  { clave: "edad", etiqueta: "Edad", tipo: "numero", formato: entero },
];

export const VARIABLE = Object.fromEntries(VARIABLES.map((v) => [v.clave, v])) as Record<ClaveVariable, DefinicionVariable>;

export function tieneValor(v: unknown): v is number | boolean {
  return v !== null && v !== undefined && !(typeof v === "number" && Number.isNaN(v));
}

/** "Promedio acumulado: 2,8" */
export function describirValor(clave: ClaveVariable, valor: number | boolean): string {
  const def = VARIABLE[clave];
  return `${def.etiqueta}: ${def.formato(valor)}`;
}
