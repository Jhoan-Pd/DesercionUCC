import {
  CODIGO_DANE_PASTO,
  aFilaMatricula,
  depurarMatricula,
  programasActivosUccPasto,
  totalPorAnio,
  totalPorCampus,
  type FilaMatriculaMen,
  type FilaProgramaMen,
} from "./datos-abiertos-depuracion";
import { DATOS_UCC, type DatosAbiertosUcc } from "./datos-abiertos";

/**
 * Descarga en vivo de las cifras oficiales de la UCC desde datos.gov.co (API SODA, sin clave).
 * La usan el comando `npm run datos:actualizar` (que guarda el respaldo data/datos-abiertos/ucc.json)
 * y la página pública /datos-abiertos, que se regenera con ISR. Las dos aplican el mismo filtro y la
 * misma depuración (lib/datos-abiertos-depuracion.ts).
 */
const API = "https://www.datos.gov.co";
/** datos.gov.co a veces tarda: una regeneración no debe quedarse colgada */
const TIEMPO_MAXIMO_MS = 15_000;

/** Solo las columnas que se usan (la respuesta pesa la mitad que con todas) */
const COLUMNAS_MATRICULA: readonly (keyof FilaMatriculaMen)[] = [
  "a_o",
  "semestre",
  "c_digo_de_la_instituci_n",
  "instituci_n_de_educaci_n_superior_ies",
  "c_digo_del_municipio_programa",
  "municipio_de_oferta_del_programa",
  "c_digo_snies_delprograma",
  "programa_acad_mico",
  "n_cleo_b_sico_del_conocimiento_nbc",
  "id_g_nero",
  "id_nivel_formacion",
  "id_metodologia",
  "matriculados_2015",
];

/** Opciones que se pasan a fetch: en Next.js, `next.revalidate` guarda la respuesta en su caché de datos */
export type OpcionesFetch = RequestInit & { next?: { revalidate?: number | false } };

async function consultar<T>(id: string, where: string, select: readonly string[] | null, opciones: OpcionesFetch): Promise<T[]> {
  const params = new URLSearchParams({ $limit: "50000", $where: where });
  if (select) params.set("$select", select.join(","));
  const r = await fetch(`${API}/resource/${id}.json?${params}`, { ...opciones, headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
  if (!r.ok) throw new Error(`datos.gov.co respondió ${r.status} para ${id}`);
  return (await r.json()) as T[];
}

async function fechaActualizacion(id: string, opciones: OpcionesFetch): Promise<string> {
  const r = await fetch(`${API}/api/views/${id}.json`, { ...opciones, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
  if (!r.ok) throw new Error(`No se pudieron leer los metadatos de ${id}`);
  const m = (await r.json()) as { rowsUpdatedAt?: number };
  return m.rowsUpdatedAt ? new Date(m.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : "";
}

/**
 * Arma el conjunto de datos a partir de las filas crudas del MEN (función pura, probada).
 * Los textos fijos de las fuentes (filtro, depuración, licencia) se toman de `base`.
 */
export function construirDatosUcc(
  base: DatosAbiertosUcc,
  crudas: FilaMatriculaMen[],
  programas: FilaProgramaMen[],
  actualizado: { matricula: string; programas: string },
  hoy: Date = new Date(),
): DatosAbiertosUcc & { conflictos: string[]; duplicadas: number } {
  const { filas, duplicadas, conflictos } = depurarMatricula(crudas);
  if (filas.length === 0) throw new Error("datos.gov.co no devolvió matrícula de la UCC");
  const anios = [...new Set(filas.map((f) => f.a_o))].sort();
  const ultimoAnio = anios[anios.length - 1];
  const pasto = filas
    .filter((f) => f.c_digo_del_municipio_programa === CODIGO_DANE_PASTO)
    .map(aFilaMatricula)
    .sort((a, b) => a[0].localeCompare(b[0]) || Number(a[2]) - Number(b[2]) || a[5].localeCompare(b[5]));
  return {
    ...base,
    descargadoEn: hoy.toISOString().slice(0, 10),
    fuentes: {
      matricula: { ...base.fuentes.matricula, actualizado: actualizado.matricula },
      programas: { ...base.fuentes.programas, actualizado: actualizado.programas },
    },
    nota: `En el conjunto de matrícula la UCC aparece de ${anios[0]} a ${ultimoAnio}, solo con el semestre 1 de cada año.`,
    matriculaNacionalPorAnio: totalPorAnio(filas),
    anioCampus: ultimoAnio,
    matriculaPorCampus: totalPorCampus(filas, ultimoAnio),
    matriculaPasto: pasto,
    programasActivosPasto: programasActivosUccPasto(programas),
    conflictos,
    duplicadas,
  };
}

/** Descarga y depura las cifras de la UCC */
export async function descargarDatosUcc(opciones: OpcionesFetch = {}, base: DatosAbiertosUcc = DATOS_UCC) {
  const [crudas, programas, matricula, programasAct] = await Promise.all([
    consultar<FilaMatriculaMen>("5wck-szir", "upper(instituci_n_de_educaci_n_superior_ies) like '%COOPERATIVA DE COLOMBIA%'", COLUMNAS_MATRICULA, opciones),
    consultar<FilaProgramaMen>("upr9-nkiz", `upper(nombreinstitucion) like '%COOPERATIVA DE COLOMBIA%' AND codigomunicipioprograma='${CODIGO_DANE_PASTO}'`, null, opciones),
    fechaActualizacion("5wck-szir", opciones),
    fechaActualizacion("upr9-nkiz", opciones),
  ]);
  return { ...construirDatosUcc(base, crudas, programas, { matricula, programas: programasAct }), filasDescargadas: crudas.length };
}

export type OrigenDatos = { tipo: "en-vivo"; consultadoEn: string } | { tipo: "respaldo"; motivo: string };

/**
 * Para las páginas: datos en vivo si datos.gov.co responde; si no, el respaldo guardado en el
 * repositorio (nunca se muestra una página vacía ni cifras inventadas). Se informa cuál se usó.
 */
export async function obtenerDatosUcc(opciones: OpcionesFetch = {}): Promise<{ datos: DatosAbiertosUcc; origen: OrigenDatos }> {
  try {
    const datos = await descargarDatosUcc(opciones);
    return { datos, origen: { tipo: "en-vivo", consultadoEn: new Date().toISOString() } };
  } catch (e) {
    console.warn("[datos abiertos] Se usa el respaldo del repositorio:", e instanceof Error ? e.message : e);
    return { datos: DATOS_UCC, origen: { tipo: "respaldo", motivo: e instanceof Error ? e.message : "sin conexión con datos.gov.co" } };
  }
}
