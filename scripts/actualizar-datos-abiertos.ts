/**
 * Descarga de datos.gov.co las cifras oficiales de la UCC y regenera data/datos-abiertos/ucc.json.
 *
 *   npm run datos:actualizar
 *
 * Usa la API pública SODA (no requiere clave). Solo trae cifras agregadas del Ministerio de Educación:
 *  - MEN_MATRICULA_ESTADISTICA_ES (5wck-szir): matrícula por programa, sexo, nivel y año.
 *  - MEN_PROGRAMAS_DE_EDUCACIÓN_SUPERIOR (upr9-nkiz): programas activos.
 * El filtro (solo UCC y sede Pasto) y la depuración de duplicados están en lib/datos-abiertos-depuracion.ts.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CODIGO_DANE_PASTO,
  aFilaMatricula,
  depurarMatricula,
  programasActivosUccPasto,
  totalPorAnio,
  totalPorCampus,
  type FilaMatriculaMen,
  type FilaProgramaMen,
} from "../lib/datos-abiertos-depuracion";

const API = "https://www.datos.gov.co";
const ARCHIVO = path.join(__dirname, "..", "data", "datos-abiertos", "ucc.json");

async function consultar<T>(id: string, where: string): Promise<T[]> {
  const url = `${API}/resource/${id}.json?$limit=50000&$where=${encodeURIComponent(where)}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`datos.gov.co respondió ${r.status} para ${id}`);
  return (await r.json()) as T[];
}

async function metadatos(id: string): Promise<{ actualizado: string }> {
  const r = await fetch(`${API}/api/views/${id}.json`);
  if (!r.ok) throw new Error(`No se pudieron leer los metadatos de ${id}`);
  const m = (await r.json()) as { rowsUpdatedAt?: number };
  return { actualizado: m.rowsUpdatedAt ? new Date(m.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : "" };
}

async function main() {
  console.log("Descargando matrícula de la UCC (5wck-szir)...");
  const crudas = await consultar<FilaMatriculaMen>("5wck-szir", "upper(instituci_n_de_educaci_n_superior_ies) like '%COOPERATIVA DE COLOMBIA%'");
  const { filas, duplicadas, conflictos } = depurarMatricula(crudas);
  console.log(`  ${crudas.length} filas descargadas, ${duplicadas} duplicadas eliminadas, ${filas.length} únicas.`);
  if (conflictos.length) console.warn(`  ⚠️ ${conflictos.length} registros duplicados con cantidades distintas (se tomó la mayor):`, conflictos.slice(0, 5));

  const anios = [...new Set(filas.map((f) => f.a_o))].sort();
  const ultimoAnio = anios[anios.length - 1];
  const pasto = filas
    .filter((f) => f.c_digo_del_municipio_programa === CODIGO_DANE_PASTO)
    .map(aFilaMatricula)
    .sort((a, b) => a[0].localeCompare(b[0]) || Number(a[2]) - Number(b[2]) || a[5].localeCompare(b[5]));

  console.log("Descargando programas de la UCC en Pasto (upr9-nkiz)...");
  const programas = await consultar<FilaProgramaMen>("upr9-nkiz", `upper(nombreinstitucion) like '%COOPERATIVA DE COLOMBIA%' AND codigomunicipioprograma='${CODIGO_DANE_PASTO}'`);

  const [mMat, mProg] = await Promise.all([metadatos("5wck-szir"), metadatos("upr9-nkiz")]);
  const actual = JSON.parse(await readFile(ARCHIVO, "utf8"));
  const nuevo = {
    ...actual,
    descargadoEn: new Date().toISOString().slice(0, 10),
    fuentes: {
      matricula: { ...actual.fuentes.matricula, actualizado: mMat.actualizado },
      programas: { ...actual.fuentes.programas, actualizado: mProg.actualizado },
    },
    nota: `En el conjunto de matrícula la UCC aparece de ${anios[0]} a ${ultimoAnio}.`,
    matriculaNacionalPorAnio: totalPorAnio(filas),
    anioCampus: ultimoAnio,
    matriculaPorCampus: totalPorCampus(filas, ultimoAnio),
    matriculaPasto: pasto,
    programasActivosPasto: programasActivosUccPasto(programas),
  };
  await writeFile(ARCHIVO, `${JSON.stringify(nuevo, null, 2)}\n`);
  console.log(`✅ ${ARCHIVO} actualizado (Pasto: ${pasto.length} filas; ${nuevo.programasActivosPasto.length} programas activos).`);
}

main().catch((e) => {
  console.error("❌ No se pudieron actualizar los datos abiertos:", e);
  process.exit(1);
});
