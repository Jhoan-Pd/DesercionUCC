import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ENCABEZADOS_PLANTILLA, leerBooleano, leerCSV, leerEstado, leerNumero, validarTabla } from "@/services/carga/lector";
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

  it("distingue el semestre vacío del semestre inválido", () => {
    const r = leerCSV("codigo,nombre,programa,semestre\nA1,Ana,Derecho,\nA2,Bea,Derecho,quince");
    expect(r.errores.map((e) => e.mensaje)).toEqual(["falta el semestre", 'semestre debe ser un número entero de 1 a 14 (llegó "quince")']);
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

describe("textos libres", () => {
  it("rechaza programas, nombres o periodos demasiado largos y limpia los caracteres de control", () => {
    const largo = "Derecho ".repeat(20);
    const r = leerCSV(`codigo;nombre;programa;semestre;periodo\nA1;Ana\tPaz;${largo};3;2026-2\nA2;Luis\u0007 Gómez;Derecho;3;2026-2`);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0].mensaje).toContain("programa es demasiado largo (máximo 120 caracteres)");
    expect(r.estudiantes[0].nombre).toBe("Luis Gómez");
  });
});

describe("Excel", () => {
  it("la plantilla trae las columnas en orden y se puede leer de vuelta", async () => {
    const buffer = await plantillaExcel();
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet("Estudiantes")!;
    hoja.addRow(["B7", "Carlos Ruiz", "Ingeniería Industrial", 4, 2.9, 2, 78, 1, true, false, true, 240, 23, "activo", "2026-2"]);
    const tabla = await leerExcel(await libro.xlsx.writeBuffer() as ArrayBuffer);
    expect(tabla.encabezados).toEqual(ENCABEZADOS_PLANTILLA);
    const r = validarTabla(tabla);
    expect(r.errores).toEqual([]);
    expect(r.estudiantes[0]).toMatchObject({ codigo: "B7", promedio: 2.9, trabaja: true, apoyoFinanciero: false, moraMatricula: true, semestre: 4 });
  });

  it("una celda con formato de porcentaje se lee como se ve (85 %, no 0,85)", async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Estudiantes");
    hoja.addRow(ENCABEZADOS_PLANTILLA);
    const fila = hoja.addRow(["B8", "Ana Paz", "Derecho", 2, 3.8, 0, 0.855, 3, false, true, false, 310, 19, "activo", "2026-2"]);
    fila.getCell(7).numFmt = "0.0%";
    const r = validarTabla(await leerExcel((await libro.xlsx.writeBuffer()) as ArrayBuffer));
    expect(r.estudiantes[0].asistencia).toBe(85.5);
  });

  it("lee miles de filas en tiempo lineal", async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Estudiantes");
    hoja.addRow(ENCABEZADOS_PLANTILLA);
    for (let i = 0; i < 5000; i++) hoja.addRow([`C${i}`, `Est ${i}`, "Derecho", 3, 3.5, 1, 85, 2, "no", "sí", "no", 300, 20, "activo", "2026-2"]);
    const buffer = (await libro.xlsx.writeBuffer()) as ArrayBuffer;
    const inicio = performance.now();
    const tabla = await leerExcel(buffer);
    expect(tabla.filas).toHaveLength(5000);
    expect(performance.now() - inicio).toBeLessThan(5000); // antes: ~25 s (cuadrático)
  });
});
