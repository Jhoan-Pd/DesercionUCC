import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { FORMATO_EXCEL, fechaReporte, formatearCelda, nombreArchivo, nombreHoja, textoPdf } from "./formato";
import type { DatosReporte, FormatoReporte, GraficoBarras, Indicador, SeccionReporte } from "./tipos";

/** Colores institucionales (ARGB para Excel) */
const AZUL = "FF00549F";
const AZUL_OSCURO = "FF003A70";
const GRIS_FILA = "FFF2F6FA";

/** Mismos colores en RGB para el PDF */
const RGB_AZUL: [number, number, number] = [0, 84, 159];
const RGB_AZUL_OSCURO: [number, number, number] = [0, 58, 112];
const RGB_VERDE: [number, number, number] = [111, 168, 28];
const RGB_TINTA: [number, number, number] = [27, 36, 48];
const RGB_GRIS: [number, number, number] = [95, 105, 118];
const RGB_BORDE: [number, number, number] = [214, 222, 232];

/** Geometría de la página A4 en puntos */
const MARGEN = 40;
const ALTO_PIE = 36;

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

  // -------------------------------------------------------------------
  // PDF
  // -------------------------------------------------------------------

  /** Documento PDF (A4 vertical): portada con encabezado institucional, secciones, tablas y pie con paginación */
  aPdf(): Buffer {
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    doc.setProperties({ title: textoPdf(this.datos.titulo), subject: textoPdf(this.datos.subtitulo), creator: "Observatorio de Deserción UCC" });
    const ancho = doc.internal.pageSize.getWidth();
    const util = ancho - 2 * MARGEN;

    // Encabezado de la primera página
    doc.setFillColor(...RGB_AZUL_OSCURO);
    doc.rect(0, 0, ancho, 78, "F");
    doc.setFillColor(...RGB_VERDE);
    doc.rect(0, 78, ancho, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(17);
    doc.text(textoPdf(this.datos.titulo), MARGEN, 36);
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(textoPdf("Observatorio de Deserción · Universidad Cooperativa de Colombia, sede Pasto"), MARGEN, 56);

    let y = 104;
    doc.setTextColor(...RGB_TINTA).setFontSize(10);
    y = this.parrafo(doc, this.datos.subtitulo, y, util, 10, RGB_TINTA);
    doc.setFontSize(8.5).setTextColor(...RGB_GRIS);
    const meta = `Generado: ${fechaReporte(this.datos.generadoEn)}  ·  Rol: ${this.datos.generadoPorRol}  ·  Filtros: ${this.datos.filtros.length ? this.datos.filtros.join(", ") : "ninguno (toda la universidad)"}`;
    y = this.parrafo(doc, meta, y + 2, util, 8.5, RGB_GRIS) + 8;

    for (const seccion of this.datos.secciones) {
      y = this.seccionPdf(doc, seccion, y, util);
    }

    // Aviso de privacidad al final
    y = this.asegurarEspacio(doc, y, 50);
    doc.setDrawColor(...RGB_BORDE).line(MARGEN, y, MARGEN + util, y);
    this.parrafo(doc, this.datos.avisoPrivacidad, y + 12, util, 8, RGB_GRIS);

    this.piesDePagina(doc);
    return Buffer.from(doc.output("arraybuffer"));
  }

  private seccionPdf(doc: jsPDF, seccion: SeccionReporte, yInicial: number, util: number): number {
    let y = this.asegurarEspacio(doc, yInicial, 90);
    doc.setFont("helvetica", "bold").setFontSize(12.5).setTextColor(...RGB_AZUL);
    doc.text(textoPdf(seccion.titulo), MARGEN, y);
    y += 6;
    doc.setDrawColor(...RGB_AZUL).setLineWidth(0.8).line(MARGEN, y, MARGEN + 36, y);
    y += 12;
    if (seccion.descripcion) y = this.parrafo(doc, seccion.descripcion, y, util, 9, RGB_GRIS) + 4;
    if (seccion.indicadores?.length) y = this.indicadoresPdf(doc, seccion.indicadores, y, util) + 6;
    if (seccion.barras && seccion.barras.datos.length) y = this.barrasPdf(doc, seccion.barras, y, util) + 8;

    if (seccion.tabla && seccion.tabla.filas.length) {
      const columnas = seccion.tabla.columnas;
      autoTable(doc, {
        startY: y,
        margin: { left: MARGEN, right: MARGEN, bottom: ALTO_PIE + 14, top: 46 },
        head: [columnas.map((c) => textoPdf(c.titulo))],
        body: seccion.tabla.filas.map((fila) => fila.map((v, j) => textoPdf(formatearCelda(v, columnas[j].formato)))),
        styles: { font: "helvetica", fontSize: 7.8, cellPadding: 3.2, textColor: RGB_TINTA, lineColor: RGB_BORDE, lineWidth: 0.4, overflow: "linebreak" },
        headStyles: { fillColor: RGB_AZUL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [242, 246, 250] },
        columnStyles: Object.fromEntries(columnas.map((c, j) => [j, { halign: c.formato === "texto" ? "left" : "right" }])),
        // Encabezado discreto en las páginas que agrega la tabla
        didDrawPage: (data) => {
          if (data.pageNumber > 1) this.encabezadoContinuacion(doc);
        },
      });
      // lastAutoTable lo agrega el plugin al documento
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;
    }

    for (const nota of seccion.notas ?? []) {
      y = this.asegurarEspacio(doc, y, 24);
      y = this.parrafo(doc, nota, y, util, 8, RGB_GRIS, "italic") + 2;
    }
    return y + 14;
  }

  /** Tarjetas de indicadores en una rejilla de 3 columnas */
  private indicadoresPdf(doc: jsPDF, indicadores: Indicador[], yInicial: number, util: number): number {
    const columnas = 3;
    const separacion = 8;
    const anchoCaja = (util - separacion * (columnas - 1)) / columnas;
    const altoCaja = 58;
    let y = yInicial;
    indicadores.forEach((ind, i) => {
      const col = i % columnas;
      if (col === 0) {
        if (i > 0) y += altoCaja + separacion;
        y = this.asegurarEspacio(doc, y, altoCaja + 4);
      }
      const x = MARGEN + col * (anchoCaja + separacion);
      doc.setDrawColor(...RGB_BORDE).setFillColor(248, 250, 252).setLineWidth(0.6);
      doc.roundedRect(x, y, anchoCaja, altoCaja, 4, 4, "FD");
      doc.setFont("helvetica", "normal").setFontSize(7.6).setTextColor(...RGB_GRIS);
      doc.text(doc.splitTextToSize(textoPdf(ind.etiqueta), anchoCaja - 14).slice(0, 2), x + 7, y + 12);
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...RGB_TINTA);
      doc.text(textoPdf(ind.valor), x + 7, y + 38);
      if (ind.detalle) {
        doc.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...RGB_GRIS);
        doc.text(doc.splitTextToSize(textoPdf(ind.detalle), anchoCaja - 14)[0] ?? "", x + 7, y + 51);
      }
    });
    return y + altoCaja;
  }

  /** Gráfico de barras horizontales dibujado con rectángulos (máximo 12 barras) */
  private barrasPdf(doc: jsPDF, grafico: GraficoBarras, yInicial: number, util: number): number {
    const datos = grafico.datos.slice(0, 12);
    const altoFila = 15;
    let y = this.asegurarEspacio(doc, yInicial, 24 + datos.length * altoFila);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...RGB_TINTA);
    doc.text(textoPdf(grafico.titulo), MARGEN, y);
    y += 10;
    const anchoEtiqueta = 150;
    const anchoValor = 70;
    const anchoBarra = util - anchoEtiqueta - anchoValor;
    const maximo = Math.max(...datos.map((d) => Math.abs(d.valor)), 1e-9);
    const formato = grafico.formato === "entero" ? "entero" : grafico.formato;
    for (const d of datos) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...RGB_TINTA);
      const etiqueta = doc.splitTextToSize(textoPdf(d.etiqueta), anchoEtiqueta - 8)[0] ?? "";
      doc.text(etiqueta, MARGEN, y + 9);
      const largo = Math.max(1, (Math.abs(d.valor) / maximo) * anchoBarra);
      doc.setFillColor(...RGB_AZUL);
      doc.roundedRect(MARGEN + anchoEtiqueta, y + 2, largo, altoFila - 5, 1.5, 1.5, "F");
      doc.setTextColor(...RGB_TINTA);
      doc.text(textoPdf(formatearCelda(d.valor, formato)), MARGEN + anchoEtiqueta + largo + 4, y + 9);
      y += altoFila;
    }
    return y;
  }

  /** Escribe un párrafo con ajuste de línea y devuelve la nueva posición vertical */
  private parrafo(
    doc: jsPDF,
    texto: string,
    yInicial: number,
    util: number,
    tamano: number,
    color: [number, number, number],
    estilo: "normal" | "italic" | "bold" = "normal",
  ): number {
    // Cada párrafo fija su propio estilo para que no herede la negrita de un título anterior
    doc.setFont("helvetica", estilo).setFontSize(tamano).setTextColor(...color);
    const lineas: string[] = doc.splitTextToSize(textoPdf(texto), util);
    const altoLinea = tamano * 1.3;
    let y = yInicial;
    for (const linea of lineas) {
      y = this.asegurarEspacio(doc, y, altoLinea);
      doc.text(linea, MARGEN, y);
      y += altoLinea;
    }
    return y;
  }

  /** Si no cabe `alto`, agrega una página y devuelve la posición inicial de la nueva */
  private asegurarEspacio(doc: jsPDF, y: number, alto: number): number {
    const limite = doc.internal.pageSize.getHeight() - ALTO_PIE - 14;
    if (y + alto <= limite) return y;
    doc.addPage();
    this.encabezadoContinuacion(doc);
    return 62;
  }

  private encabezadoContinuacion(doc: jsPDF): void {
    const ancho = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...RGB_AZUL_OSCURO);
    doc.text(textoPdf(this.datos.titulo), MARGEN, 30);
    doc.setDrawColor(...RGB_BORDE).setLineWidth(0.6).line(MARGEN, 36, ancho - MARGEN, 36);
    doc.setFont("helvetica", "normal");
  }

  private piesDePagina(doc: jsPDF): void {
    const total = doc.getNumberOfPages();
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(...RGB_BORDE).setLineWidth(0.6).line(MARGEN, alto - ALTO_PIE, ancho - MARGEN, alto - ALTO_PIE);
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...RGB_GRIS);
      doc.text(textoPdf("Observatorio de Deserción UCC · Información anonimizada (Ley 1581 de 2012)"), MARGEN, alto - ALTO_PIE + 14);
      doc.text(`Página ${i} de ${total}`, ancho - MARGEN, alto - ALTO_PIE + 14, { align: "right" });
    }
  }
}
