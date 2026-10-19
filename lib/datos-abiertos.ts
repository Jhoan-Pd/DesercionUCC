import datos from "@/data/datos-abiertos/ucc.json";

/**
 * Cifras oficiales de la UCC tomadas de datos.gov.co (Ministerio de Educación Nacional).
 *
 * Son cifras AGREGADAS (matriculados por programa, sexo y año): no hay ningún dato de estudiantes
 * individuales. El archivo data/datos-abiertos/ucc.json se genera con `npm run datos:actualizar`
 * (scripts/actualizar-datos-abiertos.ts), que aplica el filtro y la depuración descritos en el mismo
 * archivo. Aquí solo hay funciones puras para resumir esas filas; se prueban en tests/datos-abiertos.test.ts.
 */

/** [anio, codigoInstitucion, codigoSnies, programa, nucleoBasico, sexo, nivelFormacion, metodologia, matriculados] */
export type FilaMatricula = [string, string, string, string, string, string, string, string, number];
/** [codigoInstitucion, tituloOtorgado, nucleoBasico, nivelFormacion, nivelAcademico, creditos, periodos, registro] */
export type FilaPrograma = [string, string, string, string, string, number, number, string];

export interface DatosAbiertosUcc {
  descargadoEn: string;
  fuentes: {
    matricula: FuenteDatos;
    programas: FuenteDatos;
  };
  nota: string;
  matriculaNacionalPorAnio: Record<string, number>;
  anioCampus: string;
  matriculaPorCampus: [string, number][];
  matriculaPasto: FilaMatricula[];
  programasActivosPasto: FilaPrograma[];
}

export interface FuenteDatos {
  nombre: string;
  publica: string;
  id: string;
  url: string;
  actualizado: string;
  licencia: string;
  filtro: string;
  depuracion: string;
}

export const DATOS_UCC = datos as unknown as DatosAbiertosUcc;

/** Niveles de formación del SNIES que son pregrado (técnica profesional, tecnológica y universitaria) */
const NIVELES_PREGRADO = new Set(["3", "4", "5", "6"]);

const PALABRAS_MENORES = new Set(["de", "del", "la", "las", "los", "y", "e", "en", "a", "con", "para", "por"]);

/** Clave para agrupar nombres que solo difieren en mayúsculas o tildes ("ODONTOLOGIA" = "Odontología") */
export function claveNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "ESPECIALIZACIÓN EN DERECHO PROCESAL PENAL" -> "Especialización en Derecho Procesal Penal" */
export function formatoTitulo(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((p, i) => (i > 0 && PALABRAS_MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** Entre varias escrituras del mismo nombre, prefiere la que tiene tildes (la más completa) */
function mejorEscritura(variantes: Iterable<string>): string {
  let mejor = "";
  let tildesMejor = -1;
  for (const v of variantes) {
    const tildes = (v.match(/[áéíóúñÁÉÍÓÚÑ]/g) ?? []).length;
    if (tildes > tildesMejor) {
      mejor = v;
      tildesMejor = tildes;
    }
  }
  return formatoTitulo(mejor);
}

export interface MatriculaAnual {
  anio: number;
  total: number;
  hombres: number;
  mujeres: number;
  pregrado: number;
  posgrado: number;
}

/** Matrícula por año (suma de todos los programas) */
export function matriculaPorAnio(filas: FilaMatricula[]): MatriculaAnual[] {
  const porAnio = new Map<number, MatriculaAnual>();
  for (const [anio, , , , , sexo, nivel, , n] of filas) {
    const a = Number(anio);
    const fila = porAnio.get(a) ?? { anio: a, total: 0, hombres: 0, mujeres: 0, pregrado: 0, posgrado: 0 };
    fila.total += n;
    if (sexo === "1") fila.hombres += n;
    if (sexo === "2") fila.mujeres += n;
    if (NIVELES_PREGRADO.has(nivel)) fila.pregrado += n;
    else fila.posgrado += n;
    porAnio.set(a, fila);
  }
  return [...porAnio.values()].sort((x, y) => x.anio - y.anio);
}

export interface MatriculaPrograma {
  programa: string;
  nivel: "Pregrado" | "Posgrado";
  total: number;
  hombres: number;
  mujeres: number;
  /** Matrícula del mismo programa en el primer año con datos (null si no existía) */
  totalInicial: number | null;
}

/**
 * Matrícula por programa en un año, agrupando por nombre (un mismo programa puede tener varios
 * códigos SNIES, p. ej. Ingeniería Industrial 9107 y 107062 tras renovar el registro).
 */
export function matriculaPorPrograma(filas: FilaMatricula[], anio: number): MatriculaPrograma[] {
  const anios = [...new Set(filas.map((f) => Number(f[0])))].sort((a, b) => a - b);
  const primero = anios[0];
  const grupos = new Map<string, { variantes: Set<string>; nivel: MatriculaPrograma["nivel"]; total: number; hombres: number; mujeres: number; inicial: number }>();
  for (const [a, , , programa, , sexo, nivel, , n] of filas) {
    const clave = claveNombre(programa);
    const g = grupos.get(clave) ?? { variantes: new Set<string>(), nivel: NIVELES_PREGRADO.has(nivel) ? "Pregrado" : "Posgrado", total: 0, hombres: 0, mujeres: 0, inicial: 0 };
    g.variantes.add(programa);
    if (Number(a) === anio) {
      g.total += n;
      if (sexo === "1") g.hombres += n;
      if (sexo === "2") g.mujeres += n;
    }
    if (Number(a) === primero) g.inicial += n;
    grupos.set(clave, g);
  }
  return [...grupos.values()]
    .filter((g) => g.total > 0)
    .map((g) => ({
      programa: mejorEscritura(g.variantes),
      nivel: g.nivel,
      total: g.total,
      hombres: g.hombres,
      mujeres: g.mujeres,
      totalInicial: g.inicial > 0 ? g.inicial : null,
    }))
    .sort((x, y) => y.total - x.total);
}

export interface ProgramaActivo {
  titulo: string;
  nucleo: string;
  nivel: string;
  nivelAcademico: string;
  creditos: number;
  semestres: number;
  registro: string;
}

export function programasActivos(filas: FilaPrograma[]): ProgramaActivo[] {
  return filas
    .map(([, titulo, nucleo, nivel, nivelAcademico, creditos, periodos, registro]) => ({
      titulo: formatoTitulo(titulo),
      nucleo,
      nivel,
      nivelAcademico,
      creditos,
      semestres: periodos,
      registro,
    }))
    .sort((a, b) => (a.nivelAcademico === b.nivelAcademico ? a.titulo.localeCompare(b.titulo, "es") : a.nivelAcademico === "Pregrado" ? -1 : 1));
}

/** Variación porcentual entre dos valores (null si el inicial es 0) */
export function variacion(inicial: number, final: number): number | null {
  if (inicial === 0) return null;
  return (final - inicial) / inicial;
}

/** Resumen listo para la página "Cifras oficiales" */
export function resumenUccPasto(d: DatosAbiertosUcc = DATOS_UCC) {
  const porAnio = matriculaPorAnio(d.matriculaPasto);
  const ultimo = porAnio[porAnio.length - 1];
  const primero = porAnio[0];
  const nacional = Object.entries(d.matriculaNacionalPorAnio)
    .map(([anio, total]) => ({ anio: Number(anio), total }))
    .sort((a, b) => a.anio - b.anio);
  const campus = [...d.matriculaPorCampus].sort((a, b) => b[1] - a[1]);
  const posicionPasto = campus.findIndex(([c]) => claveNombre(c) === "PASTO") + 1;
  return {
    porAnio,
    primero,
    ultimo,
    variacionPasto: variacion(primero.total, ultimo.total),
    nacional,
    variacionNacional: variacion(nacional[0].total, nacional[nacional.length - 1].total),
    anioCampus: Number(d.anioCampus),
    campus: campus.map(([nombre, total]) => ({ nombre, total })),
    posicionPasto,
    programas: matriculaPorPrograma(d.matriculaPasto, ultimo.anio),
    programasActivos: programasActivos(d.programasActivosPasto),
    fuentes: d.fuentes,
    nota: d.nota,
    descargadoEn: d.descargadoEn,
  };
}

export type ResumenUccPasto = ReturnType<typeof resumenUccPasto>;
