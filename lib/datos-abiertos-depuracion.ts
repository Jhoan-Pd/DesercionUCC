import type { FilaMatricula, FilaPrograma } from "./datos-abiertos";

/**
 * Filtro y depuración de los conjuntos del Ministerio de Educación en datos.gov.co.
 * Funciones puras usadas por scripts/actualizar-datos-abiertos.ts (y probadas en Vitest).
 */

export const CODIGO_DANE_PASTO = "52001";
const NOMBRE_UCC = "UNIVERSIDAD COOPERATIVA DE COLOMBIA";

/** Fila tal como la entrega la API de datos.gov.co para MEN_MATRICULA_ESTADISTICA_ES (5wck-szir) */
export interface FilaMatriculaMen {
  a_o: string;
  semestre?: string;
  c_digo_de_la_instituci_n: string;
  instituci_n_de_educaci_n_superior_ies: string;
  c_digo_del_municipio_programa: string;
  municipio_de_oferta_del_programa?: string;
  c_digo_snies_delprograma: string;
  programa_acad_mico: string;
  n_cleo_b_sico_del_conocimiento_nbc?: string;
  id_g_nero: string;
  id_nivel_formacion: string;
  id_metodologia: string;
  matriculados_2015: string;
}

/** Fila de MEN_PROGRAMAS_DE_EDUCACIÓN_SUPERIOR (upr9-nkiz) */
export interface FilaProgramaMen {
  codigoinstitucion: string;
  nombreinstitucion: string;
  codigomunicipioprograma: string;
  nombreestadoprograma: string;
  nombretituloobtenido: string;
  nombrenbc: string;
  nombrenivelformacion: string;
  nombrenivelacademico: string;
  cantidadcreditos: string;
  cantidadperiodos: string;
  nombretipoacreditacion: string;
}

export function esUcc(nombreInstitucion: string | undefined): boolean {
  return (nombreInstitucion ?? "").toUpperCase().replace(/\s+/g, " ").trim() === NOMBRE_UCC;
}

function claveRegistro(f: FilaMatriculaMen): string {
  return [f.a_o, f.semestre ?? "", f.c_digo_de_la_instituci_n, f.c_digo_del_municipio_programa, f.c_digo_snies_delprograma, f.id_g_nero, f.id_nivel_formacion, f.id_metodologia].join("|");
}

/**
 * Deja solo la UCC y elimina los registros repetidos.
 * En el conjunto original los años 2015-2019 traen cada registro dos veces (mismo programa, sexo,
 * nivel y cantidad). Se conserva UNA fila por combinación (año, semestre, institución, municipio,
 * programa SNIES, sexo, nivel, metodología). Si dos copias trajeran cantidades distintas se toma la
 * mayor y se informa en `conflictos` para revisarlo a mano.
 */
export function depurarMatricula(filas: FilaMatriculaMen[]): { filas: FilaMatriculaMen[]; duplicadas: number; conflictos: string[] } {
  const unicas = new Map<string, FilaMatriculaMen>();
  const conflictos: string[] = [];
  let duplicadas = 0;
  for (const f of filas) {
    if (!esUcc(f.instituci_n_de_educaci_n_superior_ies)) continue;
    const clave = claveRegistro(f);
    const previa = unicas.get(clave);
    if (!previa) {
      unicas.set(clave, f);
      continue;
    }
    duplicadas++;
    if (Number(previa.matriculados_2015) !== Number(f.matriculados_2015)) {
      conflictos.push(clave);
      if (Number(f.matriculados_2015) > Number(previa.matriculados_2015)) unicas.set(clave, f);
    }
  }
  return { filas: [...unicas.values()], duplicadas, conflictos };
}

export function aFilaMatricula(f: FilaMatriculaMen): FilaMatricula {
  return [
    f.a_o,
    f.c_digo_de_la_instituci_n,
    f.c_digo_snies_delprograma,
    f.programa_acad_mico.trim(),
    (f.n_cleo_b_sico_del_conocimiento_nbc ?? "").trim(),
    f.id_g_nero,
    f.id_nivel_formacion,
    f.id_metodologia,
    Number(f.matriculados_2015),
  ];
}

/** Total por año de todas las sedes de la UCC (filas ya depuradas) */
export function totalPorAnio(filas: FilaMatriculaMen[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const f of filas) r[f.a_o] = (r[f.a_o] ?? 0) + Number(f.matriculados_2015);
  return r;
}

/** Total por municipio de oferta en un año (filas ya depuradas) */
export function totalPorCampus(filas: FilaMatriculaMen[], anio: string): [string, number][] {
  const nombres = new Map<string, string>();
  const totales = new Map<string, number>();
  for (const f of filas) {
    if (f.a_o !== anio) continue;
    const cod = f.c_digo_del_municipio_programa;
    if (f.municipio_de_oferta_del_programa && !nombres.has(cod)) nombres.set(cod, f.municipio_de_oferta_del_programa.trim());
    totales.set(cod, (totales.get(cod) ?? 0) + Number(f.matriculados_2015));
  }
  return [...totales.entries()].map(([cod, total]) => [nombres.get(cod) ?? cod, total] as [string, number]).sort((a, b) => b[1] - a[1]);
}

export function programasActivosUccPasto(filas: FilaProgramaMen[]): FilaPrograma[] {
  return filas
    .filter((f) => esUcc(f.nombreinstitucion) && f.codigomunicipioprograma === CODIGO_DANE_PASTO && f.nombreestadoprograma === "Activo")
    .map((f) => [
      f.codigoinstitucion,
      f.nombretituloobtenido.trim(),
      f.nombrenbc.trim(),
      f.nombrenivelformacion,
      f.nombrenivelacademico,
      Number(f.cantidadcreditos),
      Number(f.cantidadperiodos),
      f.nombretipoacreditacion,
    ]);
}
