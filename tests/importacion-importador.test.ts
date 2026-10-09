import { describe, expect, it } from "vitest";
import { COLUMNAS, ImportadorCSV, MAX_FILAS } from "@/services/importacion/ImportadorCSV";

const CATALOGOS = {
  programas: ["Ingeniería de Sistemas", "Psicología", "Medicina"],
  periodos: ["2024-1", "2024-2", "2025-1", "2025-2", "2026-1", "2026-2"],
  causas: ["Dificultades económicas del hogar", "Bajo rendimiento académico"],
};
const importador = () => new ImportadorCSV(CATALOGOS);
const ENCABEZADO = COLUMNAS.map((c) => c.clave).join(";");

/** Fila con valores por defecto válidos; se sobrescriben los que se pasen */
function fila(cambios: Partial<Record<string, string>> = {}): string {
  const base: Record<string, string> = {
    codigo: "UCC001", nombres: "Laura", apellidos: "Rosero", sexo: "F", edad_ingreso: "18", estrato: "2", municipio: "Pasto",
    departamento: "Nariño", trabaja: "no", horas_trabajo: "0", programa: "Psicología", cohorte: "2025-1", estado: "ACTIVO",
    financiacion: "ICETEX", porcentaje_financiacion: "80", semestre: "1", periodo: "2025-1", promedio: "3,8", materias_inscritas: "6",
    materias_perdidas: "0", asistencia: "90", valor_matricula: "", saldo_deuda: "", causa_retiro: "", consentimiento: "",
  };
  const v = { ...base, ...cambios };
  return COLUMNAS.map((c) => v[c.clave] ?? "").join(";");
}
const csv = (...filas: string[]) => [ENCABEZADO, ...filas].join("\n");
const mensajes = (texto: string) => importador().analizar(texto).errores.map((e) => `${e.linea}|${e.columna}|${e.mensaje}`);

describe("ImportadorCSV — archivo válido", () => {
  it("agrupa las filas por estudiante y ordena los semestres", () => {
    const r = importador().analizar(
      csv(fila({ semestre: "2", periodo: "2025-2", promedio: "3.5" }), fila(), fila({ codigo: "UCC002", nombres: "Ana", programa: "medicina" })),
    );
    expect(r.valido).toBe(true);
    expect(r.resumen).toEqual({ filas: 3, estudiantes: 2, semestres: 3, desertores: 0 });
    const laura = r.estudiantes.find((e) => e.codigo === "UCC001")!;
    expect(laura.semestres.map((s) => s.semestre)).toEqual([1, 2]);
    expect(laura.semestres[1].promedio).toBe(3.5);
    // El programa se escribe con el nombre canónico del catálogo aunque venga en minúsculas y sin tilde
    expect(r.estudiantes.find((e) => e.codigo === "UCC002")!.programa).toBe("Medicina");
  });

  it("acepta encabezados con tildes y mayúsculas, decimales con coma, montos con puntos y alias", () => {
    const encabezado = COLUMNAS.map((c) => (c.clave === "edad_ingreso" ? "Edad Ingreso" : c.clave === "codigo" ? "Código" : c.clave)).join(";");
    const r = importador().analizar(
      [encabezado, fila({ sexo: "femenino", trabaja: "Sí", horas_trabajo: "20", estado: "activo", financiacion: "credito ucc", valor_matricula: "4.300.000", promedio: "4,25" })].join("\n"),
    );
    expect(r.errores).toEqual([]);
    const e = r.estudiantes[0];
    expect([e.sexo, e.trabaja, e.horasTrabajoSemana, e.financiacion.tipo]).toEqual(["F", true, 20, "CREDITO_UCC"]);
    expect(e.semestres[0].valorMatricula).toBe(4_300_000);
    expect(e.semestres[0].promedio).toBe(4.25);
  });

  it("un desertor puede tener la causa solo en la fila del retiro", () => {
    const r = importador().analizar(
      csv(
        fila({ estado: "DESERTOR" }),
        fila({ estado: "DESERTOR", semestre: "2", periodo: "2025-2", causa_retiro: "dificultades economicas del hogar" }),
      ),
    );
    expect(r.errores).toEqual([]);
    expect(r.estudiantes[0].causaRetiro).toBe("Dificultades económicas del hogar");
    expect(r.resumen.desertores).toBe(1);
  });

  it("la plantilla descargable pasa su propia validación", () => {
    const r = importador().analizar(ImportadorCSV.plantilla(CATALOGOS));
    expect(r.errores).toEqual([]);
    expect(r.resumen).toEqual({ filas: 5, estudiantes: 2, semestres: 5, desertores: 1 });
  });
});

describe("ImportadorCSV — errores con fila y columna", () => {
  it("reporta columnas obligatorias faltantes sin procesar filas", () => {
    const r = importador().analizar("codigo;nombres\nUCC1;Ana");
    expect(r.valido).toBe(false);
    expect(r.columnasFaltantes).toContain("estrato");
    expect(r.errores[0].mensaje).toMatch(/Faltan columnas obligatorias/);
  });

  it("valida rangos y tipos de cada celda", () => {
    const m = mensajes(csv(fila({ estrato: "7", promedio: "5,5", asistencia: "abc", sexo: "X", cohorte: "2025-3" })));
    expect(m).toContain("2|estrato|Debe estar entre 1 y 6");
    expect(m).toContain("2|promedio|Debe estar entre 0 y 5");
    expect(m).toContain("2|asistencia|Debe ser un número (use coma o punto decimal)");
    expect(m.some((x) => x.startsWith("2|sexo|Valor no permitido"))).toBe(true);
    expect(m.some((x) => x.startsWith("2|cohorte|Formato de periodo"))).toBe(true);
  });

  it("programa, periodo y causa deben existir en los catálogos", () => {
    const m = mensajes(csv(fila({ programa: "Arquitectura", periodo: "2019-1", estado: "DESERTOR", causa_retiro: "Se aburrió" })));
    expect(m.some((x) => x.startsWith("2|programa|El programa no existe"))).toBe(true);
    expect(m.some((x) => x.startsWith("2|periodo|El periodo no existe"))).toBe(true);
    expect(m.some((x) => x.startsWith("2|causa_retiro|La causa no existe"))).toBe(true);
  });

  it("reglas entre columnas: perdidas <= inscritas, horas coherentes con trabajo, periodo posterior a la cohorte", () => {
    const m = mensajes(csv(fila({ materias_perdidas: "7", trabaja: "no", horas_trabajo: "10", cohorte: "2025-2", periodo: "2025-1" })));
    expect(m).toContain("2|materias_perdidas|No puede ser mayor que las materias inscritas");
    expect(m).toContain('2|horas_trabajo|Si "trabaja" es no, las horas deben ser 0');
    expect(m).toContain("2|periodo|Es anterior a la cohorte de ingreso (2025-2)");
  });

  it("los datos del estudiante deben coincidir en todas sus filas", () => {
    const m = mensajes(csv(fila(), fila({ semestre: "2", periodo: "2025-2", estrato: "3" })));
    expect(m).toContain('3|estrato|No coincide con la fila 2 del mismo estudiante ("2")');
  });

  it("detecta semestres o periodos repetidos y periodos fuera de orden", () => {
    expect(mensajes(csv(fila(), fila({ periodo: "2025-2" })))).toContain("3|semestre|Repetido: el estudiante ya tiene ese semestre en la fila 2");
    expect(mensajes(csv(fila({ periodo: "2025-2" }), fila({ semestre: "2", periodo: "2025-2" })))).toContain("3|periodo|Repetido: el estudiante ya tiene ese periodo en la fila 2");
    expect(mensajes(csv(fila({ semestre: "2", periodo: "2025-1" }), fila({ semestre: "1", periodo: "2025-2" })))).toContain(
      "2|periodo|El semestre 2 debe ser posterior al semestre 1 (2025-2)",
    );
  });

  it("estado y causa de retiro deben ser coherentes", () => {
    expect(mensajes(csv(fila({ estado: "DESERTOR" })))).toContain("2|causa_retiro|Un estudiante DESERTOR debe tener causa de retiro");
    expect(mensajes(csv(fila({ causa_retiro: "Bajo rendimiento académico" })))).toContain(
      "2|causa_retiro|La causa de retiro solo aplica a estudiantes con estado DESERTOR",
    );
  });

  it("solo los créditos pueden tener saldo de deuda", () => {
    expect(mensajes(csv(fila({ financiacion: "BECA", saldo_deuda: "1000000" })))).toContain("2|saldo_deuda|Solo ICETEX o crédito UCC pueden tener saldo de deuda");
  });

  it("filas con un número de columnas distinto al encabezado", () => {
    expect(mensajes(`${ENCABEZADO}\nUCC1;Ana`)[0]).toMatch(/^2\|\|La fila tiene 2 columnas/);
  });

  it("todo o nada: con un error no devuelve estudiantes para importar", () => {
    const r = importador().analizar(csv(fila(), fila({ codigo: "UCC002", estrato: "0" })));
    expect(r.valido).toBe(false);
    expect(r.estudiantes).toEqual([]);
    expect(r.resumen.estudiantes).toBe(1);
  });

  it("rechaza archivos con más filas del máximo", () => {
    const filas = Array.from({ length: MAX_FILAS + 1 }, (_, i) => fila({ codigo: `U${i}` }));
    const r = importador().analizar(csv(...filas));
    expect(r.errores[0].mensaje).toMatch(/máximo por importación es 10\.000/);
  });

  it("archivo vacío", () => {
    expect(importador().analizar("").errores[0].mensaje).toBe("El archivo está vacío");
  });
});
