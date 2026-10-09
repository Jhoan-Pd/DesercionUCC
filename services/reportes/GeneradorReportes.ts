import ExcelJS from "exceljs";
import { FORMATO_EXCEL, fechaReporte, nombreArchivo, nombreHoja } from "./formato";
import type { DatosReporte, FormatoReporte, SeccionReporte } from "./tipos";

/** Colores institucionales (ARGB para Excel) */
const AZUL = "FF00549F";
const AZUL_OSCURO = "FF003A70";
const GRIS_FILA = "FFF2F6FA";

/**
 * Genera los reportes exportables a partir de un `DatosReporte`.
 * Es una clase sin acceso a la BD: recibe el contenido ya armado y anonimizado,
 * por eso se prueba sin servidor y los dos formatos salen del mismo contenido.
 */
export class GeneradorReportes {
  constructor(private readonly datos: DatosReporte) {}

  nombreArchivo(formato: FormatoReporte): string {
    return nombreArchivo(this.datos.tipo, this.datos.generadoEn, formato);
  }

  // -------------------------------------------------------------------
  // Excel
  // -------------------------------------------------------------------

  /** Libro .xlsx: hoja "Resumen" con indicadores y una hoja por cada tabla */
  async aExcel(): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = "Observatorio de Deserción UCC";
    libro.created = this.datos.generadoEn;
    libro.title = this.datos.titulo;

    const usados = new Set<string>();
    this.hojaResumen(libro.addWorksheet(nombreHoja("Resumen", usados)));

    for (const seccion of this.datos.secciones) {
      if (!seccion.tabla || seccion.tabla.filas.length === 0) continue;
      const hoja = libro.addWorksheet(nombreHoja(seccion.hoja ?? seccion.titulo, usados));
      this.hojaTabla(hoja, seccion);
    }

    const buffer = await libro.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  private hojaResumen(hoja: ExcelJS.Worksheet): void {
    hoja.columns = [{ width: 46 }, { width: 28 }, { width: 70 }];
    const titulo = hoja.addRow([this.datos.titulo]);
    titulo.font = { bold: true, size: 16, color: { argb: AZUL_OSCURO } };
    hoja.addRow([this.datos.subtitulo]).font = { italic: true, color: { argb: "FF555555" } };
    hoja.addRow([`Generado: ${fechaReporte(this.datos.generadoEn)} · Rol: ${this.datos.generadoPorRol}`]);
    hoja.addRow([`Filtros: ${this.datos.filtros.length ? this.datos.filtros.join(" · ") : "ninguno (toda la universidad)"}`]);
    hoja.addRow([]);

    for (const seccion of this.datos.secciones) {
      if (!seccion.indicadores?.length && !seccion.notas?.length) continue;
      const cabecera = hoja.addRow([seccion.titulo]);
      cabecera.font = { bold: true, size: 12, color: { argb: AZUL } };
      for (const ind of seccion.indicadores ?? []) {
        const fila = hoja.addRow([ind.etiqueta, ind.valor, ind.detalle ?? ""]);
        fila.getCell(2).font = { bold: true };
        fila.getCell(3).alignment = { wrapText: true, vertical: "top" };
      }
      for (const nota of seccion.notas ?? []) {
        const fila = hoja.addRow([nota]);
        fila.font = { italic: true, color: { argb: "FF555555" } };
        hoja.mergeCells(fila.number, 1, fila.number, 3);
        fila.getCell(1).alignment = { wrapText: true };
        fila.height = Math.min(90, 15 * Math.ceil(nota.length / 120));
      }
      hoja.addRow([]);
    }

    const aviso = hoja.addRow([this.datos.avisoPrivacidad]);
    hoja.mergeCells(aviso.number, 1, aviso.number, 3);
    aviso.getCell(1).alignment = { wrapText: true };
    aviso.getCell(1).font = { size: 9, color: { argb: "FF666666" } };
    aviso.height = 45;
  }

  private hojaTabla(hoja: ExcelJS.Worksheet, seccion: SeccionReporte): void {
    const tabla = seccion.tabla!;
    hoja.addRow([seccion.titulo]).font = { bold: true, size: 13, color: { argb: AZUL_OSCURO } };
    if (seccion.descripcion) hoja.addRow([seccion.descripcion]).font = { italic: true, color: { argb: "FF555555" } };
    hoja.addRow([]);

    const encabezado = hoja.addRow(tabla.columnas.map((c) => c.titulo));
    const filaEncabezado = encabezado.number;
    encabezado.eachCell((celda) => {
      celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
      celda.alignment = { vertical: "middle", wrapText: true };
    });
    encabezado.height = 30;

    tabla.filas.forEach((valores, i) => {
      const fila = hoja.addRow(
        valores.map((v, j) => (typeof v === "number" && tabla.columnas[j].formato === "pct" ? v / 100 : v)),
      );
      tabla.columnas.forEach((col, j) => {
        const celda = fila.getCell(j + 1);
        const formato = FORMATO_EXCEL[col.formato];
        if (formato && typeof valores[j] === "number") celda.numFmt = formato;
        if (i % 2 === 1) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_FILA } };
      });
    });

    tabla.columnas.forEach((col, j) => {
      const largoDatos = Math.max(...tabla.filas.map((f) => String(f[j] ?? "").length), 0);
      hoja.getColumn(j + 1).width = col.ancho ?? Math.min(60, Math.max(12, col.titulo.length * 0.9, largoDatos + 4));
    });

    // Encabezado fijo y filtros automáticos para que Bienestar pueda ordenar y filtrar
    hoja.views = [{ state: "frozen", ySplit: filaEncabezado }];
    hoja.autoFilter = { from: { row: filaEncabezado, column: 1 }, to: { row: filaEncabezado, column: tabla.columnas.length } };

    for (const nota of seccion.notas ?? []) {
      hoja.addRow([]);
      hoja.addRow([nota]).font = { italic: true, size: 9, color: { argb: "FF555555" } };
    }
  }
}
