import { describe, expect, it } from "vitest";
import {
  clavesCaracteristicas,
  construirPanel,
  datosActuales,
  financiacionPrincipal,
  ultimoSemestreConocido,
  valorCaracteristica,
  vectorizar,
  type RegistroEstudiante,
} from "@/services/riesgo/caracteristicas";

const notas = (n: number, cerradas = n) =>
  Array.from({ length: n }, (_, i) => ({ semestre: i + 1, promedio: 3.5 - i * 0.1, materiasPerdidas: i % 2, asistenciaPct: 90 - i, periodoCerrado: i < cerradas }));

function reg(over: Partial<RegistroEstudiante>): RegistroEstudiante {
  return {
    id: "e1", programa: "Derecho", estrato: 2, edadIngreso: 18, trabaja: true, horasTrabajoSemana: 20,
    financiacion: "ICETEX", estado: "GRADUADO", semestreActual: 10, semestreRetiro: null, notas: notas(10), ...over,
  };
}

describe("características", () => {
  it("calcula indicadores y la caída del promedio", () => {
    const d = datosActuales(reg({}))!;
    expect(d.semestre).toBe(10);
    expect(valorCaracteristica("caida_promedio", d)).toBeCloseTo(0.1);
    expect(valorCaracteristica("estrato_1_2", d)).toBe(1);
    expect(valorCaracteristica("fin_icetex", d)).toBe(1);
    expect(valorCaracteristica("horas_trabajo", d)).toBe(20);
    expect(valorCaracteristica("programa:Derecho", d)).toBe(1);
    expect(valorCaracteristica("programa:Medicina", d)).toBe(0);
  });

  it("si no trabaja, las horas valen 0 aunque haya un dato residual", () => {
    expect(valorCaracteristica("horas_trabajo", datosActuales(reg({ trabaja: false, horasTrabajoSemana: 30 }))!)).toBe(0);
  });

  it("el programa de referencia no tiene variable indicadora", () => {
    const claves = clavesCaracteristicas(["Derecho", "Medicina", "Derecho", "Psicología"], "Derecho");
    expect(claves).toContain("programa:Medicina");
    expect(claves).not.toContain("programa:Derecho");
    expect(vectorizar(datosActuales(reg({}))!, claves)).toHaveLength(claves.length);
  });

  it("la financiación principal prioriza la deuda", () => {
    expect(financiacionPrincipal(["BECA", "ICETEX"])).toBe("ICETEX");
    expect(financiacionPrincipal(["RECURSOS_PROPIOS", "BECA"])).toBe("BECA");
    expect(financiacionPrincipal([])).toBe("RECURSOS_PROPIOS");
  });

  it("rechaza características desconocidas", () => {
    expect(() => valorCaracteristica("color_favorito", datosActuales(reg({}))!)).toThrow();
  });
});

describe("panel de entrenamiento (horizonte de 2 semestres)", () => {
  it("desertor en el semestre 4: positivos en 3 y 4, negativos en 1 y 2", () => {
    const filas = construirPanel([reg({ estado: "DESERTOR", semestreActual: 4, semestreRetiro: 4, notas: notas(4) })]);
    expect(filas.map((f) => [f.semestre, f.y])).toEqual([[1, 0], [2, 0], [3, 1], [4, 1]]);
  });

  it("graduado: todas las filas son negativas", () => {
    const filas = construirPanel([reg({})]);
    expect(filas).toHaveLength(10);
    expect(filas.every((f) => f.y === 0)).toBe(true);
  });

  it("activo en el semestre 5 (en curso): excluye los semestres 4 y 5 porque su desenlace no se conoce", () => {
    const r = reg({ estado: "ACTIVO", semestreActual: 5, notas: notas(5, 4) });
    expect(ultimoSemestreConocido(r)).toBe(3);
    expect(construirPanel([r]).map((f) => f.semestre)).toEqual([1, 2, 3]);
  });

  it("aplazado tras el semestre 6: solo hasta el 4", () => {
    expect(construirPanel([reg({ estado: "APLAZADO", semestreActual: 6, notas: notas(6) })]).map((f) => f.semestre)).toEqual([1, 2, 3, 4]);
  });

  it("nunca usa notas de un periodo que no ha cerrado", () => {
    const r = reg({ estado: "DESERTOR", semestreActual: 3, semestreRetiro: 3, notas: notas(3, 2) });
    expect(construirPanel([r]).map((f) => f.semestre)).toEqual([1, 2]);
  });

  it("los datos actuales usan la nota más reciente aunque el periodo esté en curso", () => {
    const d = datosActuales(reg({ estado: "ACTIVO", semestreActual: 5, notas: notas(5, 4) }))!;
    expect(d.semestre).toBe(5);
    expect(d.promedioAnterior).toBeCloseTo(3.2);
  });
});
