import { formatoTitulo, normalizarValor } from "@/lib/texto";
import { normalizarEncabezado, parsearCSV, type TablaCSV } from "./csv";

/**
 * Lectura y validación del archivo de estudiantes que sube el administrador (CSV o Excel).
 * Funciones puras: reciben la tabla ya leída y devuelven los estudiantes válidos y los errores por fila.
 *
 * Columnas obligatorias: codigo, nombre, programa, semestre. El resto son opcionales: si una columna
 * no viene (o la celda está vacía) ese dato queda vacío y no se usa para el riesgo.
 */

export type EstadoArchivo = "ACTIVO" | "RETIRADO" | "GRADUADO";

export interface EstudianteArchivo {
  codigo: string;
  nombre: string;
  programa: string;
  semestre: number;
  promedio: number | null;
  materiasPerdidas: number | null;
  asistencia: number | null;
  estrato: number | null;
  trabaja: boolean | null;
  apoyoFinanciero: boolean | null;
  moraMatricula: boolean | null;
  puntajeSaber11: number | null;
  edad: number | null;
  estado: EstadoArchivo;
  periodo: string | null;
}

export interface ErrorFila {
  fila: number;
  mensaje: string;
}

export interface ResultadoLectura {
  estudiantes: EstudianteArchivo[];
  errores: ErrorFila[];
  /** Columnas reconocidas del archivo (nombre canónico) */
  columnas: (keyof EstudianteArchivo)[];
  /** Encabezados del archivo que no se reconocieron (se ignoran) */
  ignoradas: string[];
}

/** Rango válido de una columna numérica y cómo explicarlo en el mensaje de error */
interface Rango {
  min: number;
  max: number;
  entero?: boolean;
  texto: string;
}

interface DefColumna {
  campo: keyof EstudianteArchivo;
  /** Nombres aceptados en el encabezado (ya normalizados). El primero es el de la plantilla. */
  alias: string[];
  obligatoria?: boolean;
  descripcion: string;
  ejemplo: string;
  rango?: Rango;
}

/** Columnas de la plantilla, en orden. Toda la información de una columna (alias, rango, ayuda) vive en su fila. */
export const COLUMNAS: readonly DefColumna[] = [
  { campo: "codigo", alias: ["codigo", "codigo_estudiante", "codigo_estudiantil", "cod"], obligatoria: true, descripcion: "Código estudiantil (único por estudiante)", ejemplo: "" },
  { campo: "nombre", alias: ["nombre", "nombres", "nombre_completo", "estudiante"], obligatoria: true, descripcion: "Nombre completo", ejemplo: "" },
  { campo: "programa", alias: ["programa", "programa_academico", "carrera"], obligatoria: true, descripcion: "Programa académico", ejemplo: "Derecho" },
  { campo: "semestre", alias: ["semestre", "semestre_actual"], obligatoria: true, descripcion: "Semestre que cursa (1 a 14)", ejemplo: "3", rango: { min: 1, max: 14, entero: true, texto: "un número entero de 1 a 14" } },
  { campo: "promedio", alias: ["promedio", "promedio_acumulado", "promedio_ponderado"], descripcion: "Promedio acumulado de 0 a 5", ejemplo: "3,4", rango: { min: 0, max: 5, texto: "un número de 0 a 5" } },
  { campo: "materiasPerdidas", alias: ["materias_perdidas", "asignaturas_perdidas", "materias_reprobadas"], descripcion: "Materias perdidas en el último periodo", ejemplo: "1", rango: { min: 0, max: 20, entero: true, texto: "un número entero de 0 a 20" } },
  { campo: "asistencia", alias: ["asistencia", "porcentaje_asistencia"], descripcion: "Porcentaje de asistencia (0 a 100)", ejemplo: "85", rango: { min: 0, max: 100, texto: "un porcentaje de 0 a 100" } },
  { campo: "estrato", alias: ["estrato", "estrato_socioeconomico"], descripcion: "Estrato socioeconómico (1 a 6)", ejemplo: "2", rango: { min: 1, max: 6, entero: true, texto: "un número entero de 1 a 6" } },
  { campo: "trabaja", alias: ["trabaja", "trabaja_actualmente"], descripcion: "¿Trabaja? (sí / no)", ejemplo: "no" },
  { campo: "apoyoFinanciero", alias: ["apoyo_financiero", "beca_credito", "beca", "credito"], descripcion: "¿Tiene beca, crédito o subsidio? (sí / no)", ejemplo: "sí" },
  { campo: "moraMatricula", alias: ["mora_matricula", "pagos_pendientes", "deuda_matricula"], descripcion: "¿Tiene pagos de matrícula pendientes? (sí / no)", ejemplo: "no" },
  { campo: "puntajeSaber11", alias: ["puntaje_saber11", "saber11", "saber_11", "puntaje_icfes", "icfes"], descripcion: "Puntaje global Saber 11 (0 a 500)", ejemplo: "290", rango: { min: 0, max: 500, entero: true, texto: "un número entero de 0 a 500" } },
  { campo: "edad", alias: ["edad"], descripcion: "Edad en años", ejemplo: "20", rango: { min: 14, max: 90, entero: true, texto: "un número entero de 14 a 90" } },
  { campo: "estado", alias: ["estado", "situacion"], descripcion: "activo, retirado o graduado (vacío = activo). Los retirados y graduados sirven para entrenar el modelo", ejemplo: "activo" },
  { campo: "periodo", alias: ["periodo", "periodo_academico"], descripcion: "Periodo de los datos", ejemplo: "2026-2" },
];

/** Índices para buscar una columna en O(1): por cualquiera de sus alias y por su campo */
const POR_ALIAS = new Map<string, DefColumna>(COLUMNAS.flatMap((c) => c.alias.map((a) => [a, c] as const)));
const POR_CAMPO = new Map<keyof EstudianteArchivo, DefColumna>(COLUMNAS.map((c) => [c.campo, c]));

/** Nombre de la columna en la plantilla (el que se muestra en los mensajes de error) */
const nombreColumna = (campo: keyof EstudianteArchivo) => POR_CAMPO.get(campo)?.alias[0] ?? campo;

/** "3,5" -> 3.5 ; "85 %" -> 85 ; "" -> null ; texto -> NaN */
export function leerNumero(valor: string): number | null {
  const t = valor.trim().replace(/%$/, "").trim();
  if (t === "") return null;
  // Formato colombiano: punto de miles y coma decimal ("1.234,5"); también acepta punto decimal
  const normal = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

const VERDADERO = new Set(["si", "s", "yes", "y", "1", "true", "verdadero", "x"]);
const FALSO = new Set(["no", "n", "0", "false", "falso"]);

/** "Sí" -> true ; "no" -> false ; "" -> null ; otro -> undefined (inválido) */
export function leerBooleano(valor: string): boolean | null | undefined {
  const t = normalizarValor(valor);
  if (t === "") return null;
  if (VERDADERO.has(t)) return true;
  if (FALSO.has(t)) return false;
  return undefined;
}

/** Palabras con las que los sistemas académicos suelen escribir cada estado (vacío = activo) */
const SINONIMOS_ESTADO = new Map<string, EstadoArchivo>([
  ["", "ACTIVO"],
  ["activo", "ACTIVO"],
  ["matriculado", "ACTIVO"],
  ["retirado", "RETIRADO"],
  ["desertor", "RETIRADO"],
  ["deserto", "RETIRADO"],
  ["retiro", "RETIRADO"],
  ["cancelado", "RETIRADO"],
  ["graduado", "GRADUADO"],
  ["egresado", "GRADUADO"],
]);

export function leerEstado(valor: string): EstadoArchivo | undefined {
  return SINONIMOS_ESTADO.get(normalizarValor(valor));
}

export const MAX_FILAS = 20000;
const MAX_LARGO_CODIGO = 40;

type IndiceColumnas = Map<keyof EstudianteArchivo, number>;

/** Ubica cada columna conocida en el encabezado del archivo; las desconocidas se devuelven aparte */
function indexarColumnas(encabezados: string[]): { indice: IndiceColumnas; ignoradas: string[] } {
  const indice: IndiceColumnas = new Map();
  const ignoradas: string[] = [];
  encabezados.forEach((e, i) => {
    const def = POR_ALIAS.get(normalizarEncabezado(e));
    if (def && !indice.has(def.campo)) indice.set(def.campo, i);
    else if (e.trim() !== "") ignoradas.push(e);
  });
  return { indice, ignoradas };
}

/** Lee y valida una fila. Devuelve el estudiante y los problemas encontrados (si hay alguno, la fila se rechaza). */
function leerFila(valores: string[], indice: IndiceColumnas): { estudiante: EstudianteArchivo; problemas: string[] } {
  const problemas: string[] = [];
  const celda = (c: keyof EstudianteArchivo) => {
    const i = indice.get(c);
    return i === undefined ? "" : (valores[i] ?? "").trim();
  };
  const numero = (c: keyof EstudianteArchivo): number | null => {
    const v = leerNumero(celda(c));
    const r = POR_CAMPO.get(c)?.rango;
    if (v === null || !r) return v;
    if (Number.isNaN(v) || v < r.min || v > r.max || (r.entero && !Number.isInteger(v))) {
      problemas.push(`${nombreColumna(c)} debe ser ${r.texto} (llegó "${celda(c)}")`);
      return null;
    }
    return v;
  };
  const booleano = (c: keyof EstudianteArchivo): boolean | null => {
    const v = leerBooleano(celda(c));
    if (v === undefined) {
      problemas.push(`${nombreColumna(c)} debe ser sí o no (llegó "${celda(c)}")`);
      return null;
    }
    return v;
  };

  const codigo = celda("codigo");
  const nombre = celda("nombre").replace(/\s+/g, " ");
  const programa = celda("programa");
  if (!codigo) problemas.push("falta el código");
  if (!nombre) problemas.push("falta el nombre");
  if (!programa) problemas.push("falta el programa");
  if (codigo.length > MAX_LARGO_CODIGO) problemas.push("el código es demasiado largo");

  const semestre = numero("semestre");
  if (celda("semestre") === "") problemas.push("falta el semestre");
  const estado = leerEstado(celda("estado"));
  if (!estado) problemas.push(`estado debe ser activo, retirado o graduado (llegó "${celda("estado")}")`);

  const estudiante: EstudianteArchivo = {
    codigo,
    nombre,
    programa: formatoTitulo(programa),
    semestre: semestre ?? 0,
    promedio: numero("promedio"),
    materiasPerdidas: numero("materiasPerdidas"),
    asistencia: numero("asistencia"),
    estrato: numero("estrato"),
    trabaja: booleano("trabaja"),
    apoyoFinanciero: booleano("apoyoFinanciero"),
    moraMatricula: booleano("moraMatricula"),
    puntajeSaber11: numero("puntajeSaber11"),
    edad: numero("edad"),
    estado: estado ?? "ACTIVO",
    periodo: celda("periodo") || null,
  };
  return { estudiante, problemas };
}

export function validarTabla(tabla: TablaCSV): ResultadoLectura {
  const { indice, ignoradas } = indexarColumnas(tabla.encabezados);
  const columnas = [...indice.keys()];
  const rechazo = (mensaje: string): ResultadoLectura => ({ estudiantes: [], errores: [{ fila: 1, mensaje }], columnas, ignoradas });

  const faltan = COLUMNAS.filter((c) => c.obligatoria && !indice.has(c.campo)).map((c) => c.alias[0]);
  if (faltan.length > 0) return rechazo(`Faltan columnas obligatorias: ${faltan.join(", ")}. Descarga la plantilla para ver el formato.`);
  if (tabla.filas.length > MAX_FILAS) return rechazo(`El archivo tiene ${tabla.filas.length} filas; el máximo por carga es ${MAX_FILAS}.`);

  const estudiantes: EstudianteArchivo[] = [];
  const errores: ErrorFila[] = [];
  /** Código -> fila donde apareció por primera vez (para detectar repetidos en O(1)) */
  const vistos = new Map<string, number>();

  for (const { linea, valores } of tabla.filas) {
    const { estudiante, problemas } = leerFila(valores, indice);
    const previa = vistos.get(estudiante.codigo);
    if (estudiante.codigo && previa !== undefined) problemas.push(`el código ${estudiante.codigo} ya aparece en la fila ${previa}`);
    if (problemas.length > 0) {
      errores.push({ fila: linea, mensaje: problemas.join("; ") });
      continue;
    }
    vistos.set(estudiante.codigo, linea);
    estudiantes.push(estudiante);
  }
  return { estudiantes, errores, columnas, ignoradas };
}

export function leerCSV(texto: string): ResultadoLectura {
  return validarTabla(parsearCSV(texto));
}

export const ENCABEZADOS_PLANTILLA = COLUMNAS.map((c) => c.alias[0]);
