import { tieneValor, type ClaveVariable, type DatosEstudiante } from "./variables";

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

/** Un factor que suma al riesgo de un estudiante (mismo formato para el puntaje por factores y para el modelo) */
export interface FactorRiesgo {
  clave: string;
  etiqueta: string;
  /** Puntos que aporta al puntaje 0-100 */
  puntos: number;
  /** Explicación corta con el dato del estudiante */
  detalle: string;
}

export interface ResultadoRiesgo {
  puntaje: number;
  nivel: NivelRiesgo;
  metodo: "FACTORES" | "MODELO";
  modeloVersion: string | null;
  /** Solo los factores que suman (puntos > 0), de mayor a menor */
  factores: FactorRiesgo[];
  /** Variables que no venían en el archivo */
  faltantes: ClaveVariable[];
}

/**
 * Regla de un factor de riesgo.
 * `fuente` documenta de dónde sale el factor, para la sustentación y para mostrarlo en la ficha.
 */
interface Regla {
  clave: string;
  etiqueta: string;
  variables: ClaveVariable[];
  maximo: number;
  fuente: string;
  evaluar: (d: DatosEstudiante) => { puntos: number; detalle: string };
}

const MEN_2016 = "MEN – SPADIES, «Factores determinantes de la deserción» (2016)";
const ACADEMICO = "Indicador académico del periodo en curso (seguimiento institucional)";

const n1 = (v: number) => v.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/**
 * PUNTAJE POR FACTORES (se usa mientras no haya un modelo entrenado con estudiantes reales de la UCC).
 *
 * Es un puntaje de ALERTA de 0 a 100, no una probabilidad. Los factores son los que el Ministerio de
 * Educación (SPADIES) asocia con mayor deserción y los indicadores académicos que la universidad ya
 * registra. Los PESOS son un criterio experto explícito (no se estimaron con datos) y suman 100:
 *
 *   Promedio acumulado bajo ........ 25    Pagos de matrícula pendientes ..... 15
 *   Materias perdidas .............. 20    Primeros semestres ................  8
 *   Asistencia baja ................ 15    Saber 11 bajo .....................  7
 *                                          Trabaja mientras estudia ..........  5
 *                                          Estrato 1-2 sin apoyo financiero ..  5
 *
 * Cuando haya al menos 200 estudiantes con resultado conocido (retirado o graduado), el sistema entrena
 * una regresión logística con esos datos y la usa en lugar de estos pesos (ver modelo.ts).
 */
export const REGLAS: Regla[] = [
  {
    clave: "promedio",
    etiqueta: "Promedio acumulado bajo",
    variables: ["promedio"],
    maximo: 25,
    fuente: ACADEMICO,
    evaluar: ({ promedio }) => {
      const p = promedio as number;
      if (p < 3) return { puntos: 25, detalle: `Promedio de ${n1(p)}, por debajo de la nota aprobatoria (3,0).` };
      if (p < 3.5) return { puntos: 12, detalle: `Promedio de ${n1(p)}, apenas por encima de la nota aprobatoria.` };
      return { puntos: 0, detalle: "" };
    },
  },
  {
    clave: "materiasPerdidas",
    etiqueta: "Materias perdidas",
    variables: ["materiasPerdidas"],
    maximo: 20,
    fuente: ACADEMICO,
    evaluar: ({ materiasPerdidas }) => {
      const m = materiasPerdidas as number;
      if (m >= 2) return { puntos: 20, detalle: `Perdió ${m} materias en el último periodo.` };
      if (m === 1) return { puntos: 10, detalle: "Perdió 1 materia en el último periodo." };
      return { puntos: 0, detalle: "" };
    },
  },
  {
    clave: "asistencia",
    etiqueta: "Asistencia baja",
    variables: ["asistencia"],
    maximo: 15,
    fuente: ACADEMICO,
    evaluar: ({ asistencia }) => {
      const a = asistencia as number;
      if (a < 70) return { puntos: 15, detalle: `Asistencia de ${Math.round(a)} %.` };
      if (a < 80) return { puntos: 8, detalle: `Asistencia de ${Math.round(a)} %, por debajo del 80 %.` };
      return { puntos: 0, detalle: "" };
    },
  },
  {
    clave: "moraMatricula",
    etiqueta: "Pagos de matrícula pendientes",
    variables: ["moraMatricula"],
    maximo: 15,
    fuente: MEN_2016,
    evaluar: ({ moraMatricula }) => (moraMatricula ? { puntos: 15, detalle: "Tiene pagos de matrícula pendientes." } : { puntos: 0, detalle: "" }),
  },
  {
    clave: "primerosSemestres",
    etiqueta: "Primeros semestres",
    variables: ["semestre"],
    maximo: 8,
    fuente: "MEN – SPADIES: la deserción por cohorte se concentra en los primeros semestres",
    evaluar: ({ semestre }) => (semestre <= 2 ? { puntos: 8, detalle: `Está en ${semestre <= 1 ? "primer" : "segundo"} semestre, la etapa con más retiros.` } : { puntos: 0, detalle: "" }),
  },
  {
    clave: "saber11",
    etiqueta: "Puntaje Saber 11 bajo",
    variables: ["puntajeSaber11"],
    maximo: 7,
    fuente: MEN_2016,
    evaluar: ({ puntajeSaber11 }) => {
      const s = puntajeSaber11 as number;
      return s < 250 ? { puntos: 7, detalle: `Puntaje Saber 11 de ${s} (de 500).` } : { puntos: 0, detalle: "" };
    },
  },
  {
    clave: "trabaja",
    etiqueta: "Trabaja mientras estudia",
    variables: ["trabaja"],
    maximo: 5,
    fuente: MEN_2016,
    evaluar: ({ trabaja }) => (trabaja ? { puntos: 5, detalle: "Trabaja mientras estudia." } : { puntos: 0, detalle: "" }),
  },
  {
    clave: "vulnerabilidadEconomica",
    etiqueta: "Estrato 1-2 sin apoyo financiero",
    variables: ["estrato", "apoyoFinanciero"],
    maximo: 5,
    fuente: MEN_2016,
    evaluar: ({ estrato, apoyoFinanciero }) =>
      (estrato as number) <= 2 && apoyoFinanciero === false ? { puntos: 5, detalle: `Estrato ${estrato} y sin beca, crédito ni subsidio.` } : { puntos: 0, detalle: "" },
  },
];

export const FUENTE_REGLA = Object.fromEntries(REGLAS.map((r) => [r.clave, r.fuente])) as Record<string, string>;

/** Umbrales del puntaje por factores */
export const UMBRAL_MEDIO = 20;
export const UMBRAL_ALTO = 45;

export function nivelPorPuntaje(puntaje: number, umbrales = { medio: UMBRAL_MEDIO, alto: UMBRAL_ALTO }): NivelRiesgo {
  if (puntaje >= umbrales.alto) return "ALTO";
  if (puntaje >= umbrales.medio) return "MEDIO";
  return "BAJO";
}

/** Calcula el puntaje por factores. Las reglas sin datos no suman y se informan como faltantes. */
export function puntajePorFactores(d: DatosEstudiante): ResultadoRiesgo {
  const factores: FactorRiesgo[] = [];
  const faltantes = new Set<ClaveVariable>();
  let puntaje = 0;
  for (const regla of REGLAS) {
    const sinDato = regla.variables.filter((v) => !tieneValor(d[v]));
    if (sinDato.length > 0) {
      sinDato.forEach((v) => faltantes.add(v));
      continue;
    }
    const { puntos, detalle } = regla.evaluar(d);
    if (puntos > 0) {
      puntaje += puntos;
      factores.push({ clave: regla.clave, etiqueta: regla.etiqueta, puntos, detalle });
    }
  }
  factores.sort((a, b) => b.puntos - a.puntos);
  puntaje = Math.min(100, puntaje);
  return { puntaje, nivel: nivelPorPuntaje(puntaje), metodo: "FACTORES", modeloVersion: null, factores, faltantes: [...faltantes] };
}

/** Puntos máximos que se pudieron evaluar con los datos disponibles (para avisar si la evaluación es incompleta) */
export function coberturaFactores(d: DatosEstudiante): number {
  const total = REGLAS.reduce((s, r) => s + r.maximo, 0);
  const evaluable = REGLAS.filter((r) => r.variables.every((v) => tieneValor(d[v]))).reduce((s, r) => s + r.maximo, 0);
  return evaluable / total;
}
