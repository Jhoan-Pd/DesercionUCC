/**
 * Características del modelo de riesgo de deserción y construcción del panel de entrenamiento.
 *
 * Unidad de análisis: ESTUDIANTE-SEMESTRE. Para cada semestre k que un estudiante cursó se
 * pregunta: ¿desertó al terminar k o el siguiente (k+1)? Es un modelo de riesgo a "un año académico".
 *
 * Decisiones (para sustentar):
 *  - Solo variables que la universidad conoce durante el semestre (notas, asistencia, trabajo,
 *    financiación...). No se usan sexo ni municipio: evitan sesgos y no son accionables.
 *  - Semestres "censurados" (cuyo desenlace aún no se conoce) se EXCLUYEN del entrenamiento.
 *    Incluirlos como "no desertó" subestimaría el riesgo de las cohortes recientes.
 *  - Funciones puras: las usan el script de exportación (Python entrena), el entrenador TS
 *    (reentrenamiento desde el panel admin) y el cálculo de puntajes, garantizando el mismo vector.
 */

export type TipoFinanciacionRiesgo = "RECURSOS_PROPIOS" | "ICETEX" | "BECA" | "CREDITO_UCC";
export type FormatoCaracteristica = "nota" | "entero" | "pct" | "binario" | "horas";

/** Datos de un estudiante en un semestre concreto (lo mínimo para calcular el vector) */
export interface DatosSemestre {
  promedio: number;
  materiasPerdidas: number;
  asistenciaPct: number;
  /** Promedio del semestre anterior (null en el primer semestre) */
  promedioAnterior: number | null;
  semestre: number;
  horasTrabajo: number;
  estrato: number;
  edadIngreso: number;
  financiacion: TipoFinanciacionRiesgo;
  programa: string;
}

export interface DefinicionCaracteristica {
  clave: string;
  etiqueta: string;
  formato: FormatoCaracteristica;
}

/** Características fijas (las de programa se agregan dinámicamente: "programa:<nombre>") */
export const CARACTERISTICAS_BASE: DefinicionCaracteristica[] = [
  { clave: "promedio", etiqueta: "Promedio del semestre", formato: "nota" },
  { clave: "materias_perdidas", etiqueta: "Materias perdidas en el semestre", formato: "entero" },
  { clave: "asistencia", etiqueta: "Asistencia a clases", formato: "pct" },
  { clave: "caida_promedio", etiqueta: "Caída del promedio frente al semestre anterior", formato: "nota" },
  { clave: "horas_trabajo", etiqueta: "Horas de trabajo a la semana", formato: "horas" },
  { clave: "estrato_1_2", etiqueta: "Estrato socioeconómico 1 o 2", formato: "binario" },
  { clave: "estrato_4_mas", etiqueta: "Estrato socioeconómico 4 o más", formato: "binario" },
  { clave: "ingreso_22_mas", etiqueta: "Ingresó a la universidad con 22 años o más", formato: "binario" },
  { clave: "primer_anio", etiqueta: "Cursa el primer año (semestre 1 o 2)", formato: "binario" },
  { clave: "semestre", etiqueta: "Semestre que cursa", formato: "entero" },
  { clave: "fin_icetex", etiqueta: "Financia la matrícula con ICETEX", formato: "binario" },
  { clave: "fin_beca", etiqueta: "Tiene beca", formato: "binario" },
  { clave: "fin_credito_ucc", etiqueta: "Financia la matrícula con crédito UCC", formato: "binario" },
];

export const PREFIJO_PROGRAMA = "programa:";

export function definicionDe(clave: string): DefinicionCaracteristica {
  const base = CARACTERISTICAS_BASE.find((c) => c.clave === clave);
  if (base) return base;
  if (clave.startsWith(PREFIJO_PROGRAMA)) {
    return { clave, etiqueta: `Programa: ${clave.slice(PREFIJO_PROGRAMA.length)}`, formato: "binario" };
  }
  throw new Error(`Característica desconocida: ${clave}`);
}

/** Valor numérico de una característica para unos datos de semestre */
export function valorCaracteristica(clave: string, d: DatosSemestre): number {
  switch (clave) {
    case "promedio":
      return d.promedio;
    case "materias_perdidas":
      return d.materiasPerdidas;
    case "asistencia":
      return d.asistenciaPct;
    case "caida_promedio":
      return d.promedioAnterior === null ? 0 : Math.max(0, d.promedioAnterior - d.promedio);
    case "horas_trabajo":
      return Math.min(Math.max(d.horasTrabajo, 0), 60);
    case "estrato_1_2":
      return d.estrato <= 2 ? 1 : 0;
    case "estrato_4_mas":
      return d.estrato >= 4 ? 1 : 0;
    case "ingreso_22_mas":
      return d.edadIngreso >= 22 ? 1 : 0;
    case "primer_anio":
      return d.semestre <= 2 ? 1 : 0;
    case "semestre":
      return d.semestre;
    case "fin_icetex":
      return d.financiacion === "ICETEX" ? 1 : 0;
    case "fin_beca":
      return d.financiacion === "BECA" ? 1 : 0;
    case "fin_credito_ucc":
      return d.financiacion === "CREDITO_UCC" ? 1 : 0;
  }
  if (clave.startsWith(PREFIJO_PROGRAMA)) return d.programa === clave.slice(PREFIJO_PROGRAMA.length) ? 1 : 0;
  throw new Error(`Característica desconocida: ${clave}`);
}

export function vectorizar(d: DatosSemestre, claves: readonly string[]): number[] {
  return claves.map((c) => valorCaracteristica(c, d));
}

/**
 * Lista de características para un conjunto de programas: las base + una variable indicadora
 * por programa, excepto el programa de referencia (el más frecuente), para evitar colinealidad.
 */
export function clavesCaracteristicas(programas: string[], programaReferencia: string): string[] {
  const dummies = [...new Set(programas)]
    .filter((p) => p !== programaReferencia)
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((p) => `${PREFIJO_PROGRAMA}${p}`);
  return [...CARACTERISTICAS_BASE.map((c) => c.clave), ...dummies];
}

// ---------------------------------------------------------------------
// Panel de entrenamiento
// ---------------------------------------------------------------------

export type EstadoRiesgo = "ACTIVO" | "GRADUADO" | "DESERTOR" | "APLAZADO";

export interface NotaRegistro {
  semestre: number;
  promedio: number;
  materiasPerdidas: number;
  asistenciaPct: number;
  /** true si el periodo de esa nota ya cerró */
  periodoCerrado: boolean;
}

/** Todo lo que se necesita de un estudiante para armar sus filas del panel o su vector actual */
export interface RegistroEstudiante {
  id: string;
  programa: string;
  estrato: number;
  edadIngreso: number;
  trabaja: boolean;
  horasTrabajoSemana: number;
  financiacion: TipoFinanciacionRiesgo;
  estado: EstadoRiesgo;
  semestreActual: number;
  /** Semestre en el que se retiró (solo desertores) */
  semestreRetiro: number | null;
  notas: NotaRegistro[];
}

export interface FilaPanel {
  estudianteId: string;
  semestre: number;
  datos: DatosSemestre;
  /** 1 si desertó al terminar este semestre o el siguiente */
  y: 0 | 1;
}

/** Horizonte de predicción en semestres (2 = un año académico) */
export const HORIZONTE_SEMESTRES = 2;

/** Financiación "principal" para el modelo: la deuda manda, luego la beca, luego recursos propios */
export function financiacionPrincipal(tipos: TipoFinanciacionRiesgo[]): TipoFinanciacionRiesgo {
  if (tipos.includes("ICETEX")) return "ICETEX";
  if (tipos.includes("CREDITO_UCC")) return "CREDITO_UCC";
  if (tipos.includes("BECA")) return "BECA";
  return "RECURSOS_PROPIOS";
}

function datosDe(r: RegistroEstudiante, nota: NotaRegistro, anterior: NotaRegistro | undefined): DatosSemestre {
  return {
    promedio: nota.promedio,
    materiasPerdidas: nota.materiasPerdidas,
    asistenciaPct: nota.asistenciaPct,
    promedioAnterior: anterior ? anterior.promedio : null,
    semestre: nota.semestre,
    horasTrabajo: r.trabaja ? r.horasTrabajoSemana : 0,
    estrato: r.estrato,
    edadIngreso: r.edadIngreso,
    financiacion: r.financiacion,
    programa: r.programa,
  };
}

/**
 * Último semestre cuyo desenlace a HORIZONTE ya se conoce (o null si ninguno):
 *  - DESERTOR (retiro en r): se conocen todos los semestres hasta r.
 *  - GRADUADO (último L): todos hasta L (ya no puede desertar).
 *  - ACTIVO (cursa c): completó c-1; el semestre k se conoce si k + HORIZONTE - 1 <= c - 1.
 *  - APLAZADO (completó L): el semestre k se conoce si k + HORIZONTE - 1 <= L - 1 (L podría acabar en deserción).
 */
export function ultimoSemestreConocido(r: RegistroEstudiante): number {
  switch (r.estado) {
    case "DESERTOR":
      return r.semestreRetiro ?? r.semestreActual;
    case "GRADUADO":
      return r.semestreActual;
    case "ACTIVO":
      return r.semestreActual - HORIZONTE_SEMESTRES;
    case "APLAZADO":
      return r.semestreActual - HORIZONTE_SEMESTRES;
  }
}

export function construirPanel(registros: RegistroEstudiante[]): FilaPanel[] {
  const filas: FilaPanel[] = [];
  for (const r of registros) {
    const notas = [...r.notas].filter((n) => n.periodoCerrado).sort((a, b) => a.semestre - b.semestre);
    const limite = ultimoSemestreConocido(r);
    for (let i = 0; i < notas.length; i++) {
      const nota = notas[i];
      if (nota.semestre > limite) continue;
      const desertaPronto =
        r.estado === "DESERTOR" && r.semestreRetiro !== null && r.semestreRetiro - nota.semestre >= 0 && r.semestreRetiro - nota.semestre < HORIZONTE_SEMESTRES;
      filas.push({ estudianteId: r.id, semestre: nota.semestre, datos: datosDe(r, nota, notas[i - 1]), y: desertaPronto ? 1 : 0 });
    }
  }
  return filas;
}

/**
 * Datos del semestre más reciente (incluye el periodo en curso con sus notas parciales):
 * es lo que se usa para calcular el puntaje de riesgo de un estudiante activo.
 */
export function datosActuales(r: RegistroEstudiante): DatosSemestre | null {
  const notas = [...r.notas].sort((a, b) => a.semestre - b.semestre);
  if (notas.length === 0) return null;
  const ultima = notas[notas.length - 1];
  return datosDe(r, ultima, notas[notas.length - 2]);
}

/** Programa más frecuente (se usa como referencia de las variables indicadoras) */
export function programaMasFrecuente(registros: { programa: string }[]): string {
  const cuenta = new Map<string, number>();
  for (const r of registros) cuenta.set(r.programa, (cuenta.get(r.programa) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))[0]?.[0] ?? "";
}
