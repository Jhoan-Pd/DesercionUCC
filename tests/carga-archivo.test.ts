import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ErrorArchivo, decodificarTexto, formatoDe, leerYValidar } from "@/services/carga/archivo";
import { ENCABEZADOS_PLANTILLA } from "@/services/carga/lector";

const bytes = (texto: string) => new TextEncoder().encode(texto).buffer as ArrayBuffer;

describe("lectura compartida por el servidor y el Web Worker", () => {
  it("reconoce el formato por la extensión", () => {
    expect(formatoDe("Estudiantes 2026.XLSX")).toBe("xlsx");
    expect(formatoDe("datos.csv")).toBe("csv");
    expect(formatoDe("datos.txt")).toBe("csv");
    expect(formatoDe("notas.pdf")).toBeNull();
  });

  it("lee y valida un CSV con una fila buena y una con error", async () => {
    const r = await leerYValidar("e.csv", bytes("codigo;nombre;programa;semestre\nA1;Ana Paz;Derecho;3\nA2;Luis;Derecho;30\n"));
    expect(r.estudiantes.map((e) => e.codigo)).toEqual(["A1"]);
    expect(r.errores[0].fila).toBe(3);
  });

  it("lee un Excel con el import dinámico de ExcelJS", async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Estudiantes");
    hoja.addRow(ENCABEZADOS_PLANTILLA);
    hoja.addRow(["B1", "Eva Ruiz", "Medicina", 5, 4.1, 0, 95, 4, "no", "no", "no", 380, 21, "graduado", "2026-2"]);
    const r = await leerYValidar("e.xlsx", (await libro.xlsx.writeBuffer()) as ArrayBuffer);
    expect(r.estudiantes[0]).toMatchObject({ codigo: "B1", estado: "GRADUADO" });
  });

  it("un formato no admitido, un Excel dañado o una comilla sin cerrar son ErrorArchivo", async () => {
    await expect(leerYValidar("notas.pdf", bytes("%PDF"))).rejects.toBeInstanceOf(ErrorArchivo);
    await expect(leerYValidar("roto.xlsx", bytes("no soy un zip"))).rejects.toBeInstanceOf(ErrorArchivo);
    await expect(leerYValidar("e.csv", bytes('codigo;nombre\n1;"Ana\n'))).rejects.toBeInstanceOf(ErrorArchivo);
  });

  it("decodifica un CSV guardado en Latin-1 por Excel en Windows", () => {
    const latin1 = new Uint8Array([0x4f, 0x64, 0x6f, 0x6e, 0x74, 0x6f, 0x6c, 0x6f, 0x67, 0xed, 0x61]).buffer; // "Odontología"
    expect(decodificarTexto(latin1)).toBe("Odontología");
  });
});
