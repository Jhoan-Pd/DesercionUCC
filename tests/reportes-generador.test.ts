import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { GeneradorReportes } from "@/services/reportes/GeneradorReportes";
import { formatearCelda, nombreArchivo, nombreHoja, textoPdf } from "@/services/reportes/formato";
import { AVISO_PRIVACIDAD, type DatosReporte } from "@/services/reportes/tipos";

function datos(filasLista = 5): DatosReporte {
  return {
    tipo: "institucional",
    titulo: "Reporte de prueba",
    subtitulo: "Subtítulo con tildes: Ingeniería, Odontología, ñ",
    generadoEn: new Date("2026-10-10T03:00:00Z"),
    generadoPorRol: "Bienestar Universitario",
    filtros: ["Programa: Medicina"],
    avisoPrivacidad: AVISO_PRIVACIDAD,
    secciones: [
      { titulo: "Indicadores", indicadores: [{ etiqueta: "Desertores", valor: "512", detalle: "34,1 %" }] },
      {
        titulo: "Por programa",
        hoja: "Programas",
        barras: { titulo: "Tasa", formato: "pct", datos: [{ etiqueta: "Medicina", valor: 31.7 }, { etiqueta: "Derecho", valor: 25 }] },
        tabla: {
          columnas: [{ titulo: "Programa", formato: "texto" }, { titulo: "Tasa", formato: "pct" }, { titulo: "Monto", formato: "cop" }],
          filas: [["Medicina", 31.7, 1234567], ["Derecho", 25, null]],
        },
      },
      {
        titulo: "Lista larga",
        tabla: {
          columnas: [{ titulo: "Código", formato: "texto" }, { titulo: "Puntaje", formato: "entero" }],
          filas: Array.from({ length: filasLista }, (_, i) => [`EST-${i}`, 100 - (i % 100)]),
        },
      },
      { titulo: "Sección vacía", tabla: { columnas: [{ titulo: "A", formato: "texto" }], filas: [] } },
    ],
  };
}

describe("formato de reportes", () => {
  it("formatea celdas al estilo colombiano", () => {
    expect(formatearCelda(1234567, "cop")).toBe("$ 1.234.567");
    expect(formatearCelda(30.75, "pct")).toBe("30,8 %");
    expect(formatearCelda(1500, "entero")).toBe("1.500");
    expect(formatearCelda(null, "cop")).toBe("—");
    expect(formatearCelda("ALTO", "texto")).toBe("ALTO");
  });

  it("textoPdf conserva tildes y ñ y traduce símbolos que la fuente no tiene", () => {
    expect(textoPdf("Ingeniería, Odontología, ñ, ¿por qué? ¡sí! — “citas”")).toBe("Ingeniería, Odontología, ñ, ¿por qué? ¡sí! — “citas”");
    expect(textoPdf("≥ 45 % → prioridad")).toBe(">= 45 % -> prioridad");
    expect(textoPdf("emoji 🎓")).toBe("emoji ?");
  });

  it("nombres de hoja de Excel válidos, cortos y únicos", () => {
    const usados = new Set<string>();
    expect(nombreHoja("Deserción por programa: tasa [2026]", usados)).toBe("Deserción por programa tasa 202");
    expect(nombreHoja("Resumen", usados)).toBe("Resumen");
    expect(nombreHoja("resumen", usados)).toBe("resumen (2)");
    expect(nombreHoja("x".repeat(40), usados).length).toBeLessThanOrEqual(31);
  });

  it("el nombre de archivo usa la fecha de Colombia", () => {
    // 10-oct 03:00 UTC = 9-oct 22:00 en Bogotá
    expect(nombreArchivo("riesgo", new Date("2026-10-10T03:00:00Z"), "pdf")).toBe("observatorio-riesgo-2026-10-09.pdf");
  });
});

describe("GeneradorReportes → Excel", () => {
  it("crea una hoja de resumen y una por tabla con datos (omite las vacías)", async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await new GeneradorReportes(datos()).aExcel());
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Programas", "Lista larga"]);
  });

  it("guarda los porcentajes como fracción con formato de porcentaje y respeta los vacíos", async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await new GeneradorReportes(datos()).aExcel());
    const hoja = libro.getWorksheet("Programas")!;
    const encabezado = hoja.getRow(3);
    expect(encabezado.getCell(1).value).toBe("Programa");
    expect(hoja.getRow(4).getCell(2).value).toBeCloseTo(0.317);
    expect(hoja.getRow(4).getCell(2).numFmt).toBe("0.0%");
    expect(hoja.getRow(4).getCell(3).numFmt).toBe('"$"#,##0');
    expect(hoja.getRow(5).getCell(3).value).toBeNull();
  });

  it("la hoja de resumen incluye indicadores, filtros y el aviso de privacidad", async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await new GeneradorReportes(datos()).aExcel());
    const textos: string[] = [];
    libro.getWorksheet("Resumen")!.eachRow((fila) => fila.eachCell((c) => textos.push(String(c.value))));
    const todo = textos.join(" | ");
    expect(todo).toContain("Desertores");
    expect(todo).toContain("Programa: Medicina");
    expect(todo).toContain("Ley 1581 de 2012");
  });
});

describe("GeneradorReportes → PDF", () => {
  const paginas = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page[^s]/g) ?? []).length;

  it("produce un PDF válido", () => {
    const pdf = new GeneradorReportes(datos()).aPdf();
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(paginas(pdf)).toBe(1);
  });

  it("las tablas largas continúan en páginas nuevas", () => {
    const pdf = new GeneradorReportes(datos(200)).aPdf();
    expect(paginas(pdf)).toBeGreaterThanOrEqual(4);
  });

  it("el nombre del archivo indica el tipo y el formato", () => {
    const g = new GeneradorReportes(datos());
    expect(g.nombreArchivo("pdf")).toBe("observatorio-institucional-2026-10-09.pdf");
    expect(g.nombreArchivo("xlsx")).toBe("observatorio-institucional-2026-10-09.xlsx");
  });
});
