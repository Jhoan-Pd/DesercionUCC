import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ENCABEZADOS_PLANTILLA, leerBooleano, leerCSV, leerEstado, leerNumero, normalizarPrograma, validarTabla } from "@/services/carga/lector";
import { leerExcel, plantillaExcel } from "@/services/carga/excel";

const ENC = "codigo;nombre;programa;semestre;promedio;materias_perdidas;asistencia;estrato;trabaja;apoyo_financiero;mora_matricula;puntaje_saber11;edad;estado;periodo";

describe("Lectura de valores", () => {
  it("números con coma decimal, porcentajes y miles", () => {
    expect(leerNumero("3,5")).toBe(3.5);
    expect(leerNumero("3.5")).toBe(3.5);
    expect(leerNumero("85 %")).toBe(85);
    expect(leerNumero("1.234,5")).toBe(1234.5);
    expect(leerNumero("")).toBeNull();
    expect(leerNumero("tres")).toBeNaN();
  });

  it("sí/no en varias formas", () => {
    expect(["Sí", "si", "S", "1", "TRUE", "x"].map(leerBooleano)).toEqual([true, true, true, true, true, true]);
    expect(["No", "n", "0", "false"].map(leerBooleano)).toEqual([false, false, false, false]);
    expect(leerBooleano("")).toBeNull();
    expect(leerBooleano("tal vez")).toBeUndefined();
  });

  it("estado: vacío es activo; desertor equivale a retirado; egresado a graduado", () => {
    expect([leerEstado(""), leerEstado("Desertor"), leerEstado("egresado"), leerEstado("aplazado")]).toEqual(["ACTIVO", "RETIRADO", "GRADUADO", undefined]);
  });

  it("normaliza el nombre del programa", () => {
    expect(normalizarPrograma("  INGENIERÍA   DE SOFTWARE ")).toBe("Ingeniería de Software");
  });
});

describe("Validación del archivo", () => {
  it("acepta el formato de la plantilla con columnas opcionales vacías", () => {
    const r = leerCSV(`${ENC}\nA001;Ana Pérez;derecho;3;3,4;1;85;2;no;sí;no;290;20;;2026-2\nA002;Luis Gómez;Medicina;1;;;;;;;;;;retirado;`);
    expect(r.errores).toEqual([]);
    expect(r.estudiantes).toHaveLength(2);
    expect(r.estudiantes[0]).toMatchObject({ codigo: "A001", programa: "Derecho", promedio: 3.4, apoyoFinanciero: true, moraMatricula: false, estado: "ACTIVO" });
    expect(r.estudiantes[1]).toMatchObject({ promedio: null, trabaja: null, estado: "RETIRADO" });
  });

  it("acepta un archivo mínimo con solo las 4 columnas obligatorias y encabezados con tildes o espacios", () => {
    const r = leerCSV("Código,Nombre completo,Programa académico,Semestre\nX1,María,Odontología,5");
    expect(r.errores).toEqual([]);
    expect(r.estudiantes[0]).toMatchObject({ codigo: "X1", semestre: 5, promedio: null });
  });

  it("si faltan columnas obligatorias no carga nada y lo explica", () => {
    const r = leerCSV("codigo,nombre\nA1,Ana");
    expect(r.estudiantes).toEqual([]);
    expect(r.errores[0].mensaje).toContain("programa, semestre");
  });

  it("rechaza filas con datos fuera de rango, indicando la fila del archivo", () => {
    const r = leerCSV(`${ENC}\nA1;Ana;Derecho;3;5,8;;;;;;;;;;\nA2;Bea;Derecho;0;;;;;;;;;;;\nA3;Cris;Derecho;2;;;;9;quizás;;;;;;`);
    expect(r.estudiantes).toHaveLength(0);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 4]);
    expect(r.errores[0].mensaje).toContain("promedio debe ser un número de 0 a 5");
    expect(r.errores[1].mensaje).toContain("semestre");
    expect(r.errores[2].mensaje).toMatch(/estrato.*trabaja/);
  });

  it("detecta códigos repetidos dentro del mismo archivo", () => {
    const r = leerCSV("codigo,nombre,programa,semestre\nA1,Ana,Derecho,1\nA1,Otra,Derecho,2");
    expect(r.estudiantes).toHaveLength(1);
    expect(r.errores[0]).toEqual({ fila: 3, mensaje: "el código A1 ya aparece en la fila 2" });
  });

  it("informa las columnas que no reconoce", () => {
    const r = validarTabla({ separador: ",", encabezados: ["codigo", "nombre", "programa", "semestre", "color_favorito"], filas: [] });
    expect(r.ignoradas).toEqual(["color_favorito"]);
  });
});

describe("Excel", () => {
  it("la plantilla trae las columnas en orden y se puede leer de vuelta", async () => {
    const buffer = await plantillaExcel();
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    const hoja = libro.getWorksheet("Estudiantes")!;
    hoja.addRow(["B7", "Carlos Ruiz", "Ingeniería Industrial", 4, 2.9, 2, 78, 1, true, false, true, 240, 23, "activo", "2026-2"]);
    const tabla = await leerExcel(await libro.xlsx.writeBuffer() as ArrayBuffer);
    expect(tabla.encabezados).toEqual(ENCABEZADOS_PLANTILLA);
    const r = validarTabla(tabla);
    expect(r.errores).toEqual([]);
    expect(r.estudiantes[0]).toMatchObject({ codigo: "B7", promedio: 2.9, trabaja: true, apoyoFinanciero: false, moraMatricula: true, semestre: 4 });
  });
});
