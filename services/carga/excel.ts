import ExcelJS from "exceljs";
import type { TablaCSV } from "./csv";
import { COLUMNAS, ENCABEZADOS_PLANTILLA } from "./lector";

/** Convierte la primera hoja de un archivo .xlsx en la misma tabla que produce el lector de CSV */
export async function leerExcel(buffer: ArrayBuffer): Promise<TablaCSV> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  if (!hoja) return { separador: ",", encabezados: [], filas: [] };

  const filas: { linea: number; valores: string[] }[] = [];
  let encabezados: string[] = [];
  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    const valores: string[] = [];
    for (let c = 1; c <= hoja.columnCount; c++) {
      const celda = fila.getCell(c);
      valores.push(textoCelda(celda).trim());
    }
    if (encabezados.length === 0) {
      encabezados = valores;
      return;
    }
    if (valores.some((v) => v !== "")) filas.push({ linea: numero, valores });
  });
  return { separador: ",", encabezados, filas };
}

function textoCelda(celda: ExcelJS.Cell): string {
  const v = celda.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "result" in v) return v.result === undefined || v.result === null ? "" : String(v.result); // fórmula
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text); // hipervínculo
  return celda.text ?? String(v);
}

/** Plantilla .xlsx: hoja "Estudiantes" con los encabezados y hoja "Instrucciones" con la descripción de cada columna */
export async function plantillaExcel(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Observatorio de Deserción UCC";
  const hoja = libro.addWorksheet("Estudiantes");
  hoja.addRow(ENCABEZADOS_PLANTILLA);
  hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00549F" } };
  hoja.columns.forEach((c) => (c.width = 18));
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  const ayuda = libro.addWorksheet("Instrucciones");
  ayuda.addRow(["Columna", "Obligatoria", "Qué va", "Ejemplo"]);
  ayuda.getRow(1).font = { bold: true };
  for (const c of COLUMNAS) ayuda.addRow([c.alias[0], c.obligatoria ? "Sí" : "No", c.descripcion, c.ejemplo]);
  ayuda.addRow([]);
  ayuda.addRow(["Use datos reales de la universidad. Las columnas opcionales pueden quedar vacías: ese dato no se usa para el riesgo."]);
  ayuda.addRow(["Si un código ya existe, la fila actualiza al estudiante."]);
  ayuda.columns = [{ width: 20 }, { width: 12 }, { width: 70 }, { width: 14 }];

  return Buffer.from(await libro.xlsx.writeBuffer());
}
