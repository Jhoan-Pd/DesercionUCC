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
import { descargarDatosUcc } from "../lib/datos-abiertos-remotos";

const ARCHIVO = path.join(__dirname, "..", "data", "datos-abiertos", "ucc.json");

async function main() {
  console.log("Descargando de datos.gov.co la matrícula (5wck-szir) y los programas (upr9-nkiz) de la UCC...");
  const base = JSON.parse(await readFile(ARCHIVO, "utf8"));
  const { conflictos, duplicadas, filasDescargadas, ...datos } = await descargarDatosUcc({}, base);
  console.log(`  ${filasDescargadas} filas de matrícula descargadas, ${duplicadas} duplicadas eliminadas.`);
  if (conflictos.length) console.warn(`  ⚠️ ${conflictos.length} registros duplicados con cantidades distintas (se tomó la mayor):`, conflictos.slice(0, 5));
  await writeFile(ARCHIVO, `${JSON.stringify(datos, null, 2)}\n`);
  console.log(`✅ ${ARCHIVO} actualizado (Pasto: ${datos.matriculaPasto.length} filas; ${datos.programasActivosPasto.length} programas activos).`);
}

main().catch((e) => {
  console.error("❌ No se pudieron actualizar los datos abiertos:", e);
  process.exit(1);
});
