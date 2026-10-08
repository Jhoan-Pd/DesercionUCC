import { describe, expect, it } from "vitest";
import {
  calcularKpis,
  curvasSupervivencia,
  desercionPorCohorte,
  desercionPorPeriodo,
  desercionPorSemestre,
  resumenCausas,
  tasaAnualDesdeSemestrales,
  type EstudianteFila,
  type RetiroFila,
} from "@/services/dashboard/calculos";
import { construirReferenciasSpadies } from "@/services/parametros/conversores";

const spadies = construirReferenciasSpadies({});

function est(id: string, over: Partial<EstudianteFila> = {}): EstudianteFila {
  return { id, programaId: "p1", cohorte: "2020-1", cohorteAnio: 2020, indiceIngreso: 4, estado: "ACTIVO", semestreActual: 5, municipioOrigen: "Pasto", ...over };
}
function ret(estudianteId: string, semestreRetiro: number, over: Partial<RetiroFila> = {}): RetiroFila {
  return { estudianteId, periodoId: "per1", semestreRetiro, causaNombre: "Dificultades económicas del hogar", categoria: "SOCIOECONOMICA", ...over };
}

describe("desercionPorCohorte", () => {
  it("calcula la tasa y la referencia nacional con la antigüedad de la cohorte", () => {
    const estudiantes = [est("a", { estado: "DESERTOR" }), est("b"), est("c"), est("d", { estado: "GRADUADO" })];
    const [fila] = desercionPorCohorte(estudiantes, 14, spadies); // 14 - 4 = 10 semestres observables
    expect(fila.total).toBe(4);
    expect(fila.desertores).toBe(1);
    expect(fila.tasa).toBe(25);
    expect(fila.semestresObservados).toBe(10);
    expect(fila.referenciaNacional).toBe(36.7);
  });

  it("una cohorte sin semestres cerrados no tiene referencia nacional", () => {
    const [fila] = desercionPorCohorte([est("a", { indiceIngreso: 17 })], 17, spadies);
    expect(fila.referenciaNacional).toBeNull();
  });
});

describe("curvasSupervivencia (Kaplan-Meier)", () => {
  it("sin deserción la supervivencia se mantiene en 100%", () => {
    const estudiantes = Array.from({ length: 20 }, (_, i) => est(`e${i}`, { estado: "GRADUADO", semestreActual: 10 }));
    const { puntos } = curvasSupervivencia(estudiantes, [], spadies);
    expect(puntos.find((p) => p.semestre === 5)!["Todas"]).toBe(100);
  });

  it("calcula a mano: 20 estudiantes, 2 se retiran en el semestre 1 => S(1) = 90%", () => {
    const estudiantes = Array.from({ length: 20 }, (_, i) =>
      est(`e${i}`, i < 2 ? { estado: "DESERTOR", semestreActual: 1 } : { estado: "GRADUADO", semestreActual: 10 }),
    );
    const retiros = [ret("e0", 1), ret("e1", 1)];
    const { puntos } = curvasSupervivencia(estudiantes, retiros, spadies);
    expect(puntos[1]["Todas"]).toBe(90);
  });

  it("compone riesgos: 10% en sem 1 y luego 10% de los que quedan en sem 2 => 81%", () => {
    // 100 estudiantes: 10 se retiran en sem 1; de los 90 restantes, 9 se retiran en sem 2.
    const estudiantes: EstudianteFila[] = [];
    const retiros: RetiroFila[] = [];
    for (let i = 0; i < 100; i++) {
      if (i < 10) {
        estudiantes.push(est(`e${i}`, { estado: "DESERTOR", semestreActual: 1 }));
        retiros.push(ret(`e${i}`, 1));
      } else if (i < 19) {
        estudiantes.push(est(`e${i}`, { estado: "DESERTOR", semestreActual: 2 }));
        retiros.push(ret(`e${i}`, 2));
      } else {
        estudiantes.push(est(`e${i}`, { estado: "GRADUADO", semestreActual: 10 }));
      }
    }
    const { puntos } = curvasSupervivencia(estudiantes, retiros, spadies);
    expect(puntos[2]["Todas"]).toBe(81);
  });

  it("no oculta la censura: un estudiante activo solo cuenta en riesgo hasta su último semestre completo", () => {
    // 10 activos en semestre 3 (completaron 2) y 10 que se retiran en el semestre 3 => en sem 3 solo hay 10 en riesgo
    const estudiantes = [
      ...Array.from({ length: 10 }, (_, i) => est(`a${i}`, { estado: "ACTIVO", semestreActual: 3 })),
      ...Array.from({ length: 10 }, (_, i) => est(`d${i}`, { estado: "DESERTOR", semestreActual: 3 })),
    ];
    const retiros = Array.from({ length: 10 }, (_, i) => ret(`d${i}`, 3));
    const { puntos } = curvasSupervivencia(estudiantes, retiros, spadies);
    expect(puntos[3]["Todas"]).toBe(0); // 10 de 10 en riesgo se retiraron
  });

  it("incluye la curva nacional (100 - deserción acumulada SPADIES)", () => {
    const { puntos, series } = curvasSupervivencia([est("a", { estado: "GRADUADO", semestreActual: 10 })], [], spadies);
    expect(series).toContain("Nacional");
    expect(puntos[10]["Nacional"]).toBe(63.3);
  });
});

describe("desercionPorSemestre y por periodo", () => {
  it("la tasa por semestre es retiros / matriculados en ese semestre", () => {
    const filas = desercionPorSemestre([{ clave: 1, total: 200 }, { clave: 2, total: 150 }], [ret("a", 1), ret("b", 1), ret("c", 2)]);
    expect(filas).toEqual([
      { semestre: 1, matriculados: 200, desertores: 2, tasa: 1 },
      { semestre: 2, matriculados: 150, desertores: 1, tasa: 0.7 },
    ]);
  });

  it("la tasa por periodo respeta el orden cronológico y omite periodos sin matriculados", () => {
    const filas = desercionPorPeriodo(
      [{ id: "b", codigo: "2019-2", indice: 3 }, { id: "a", codigo: "2019-1", indice: 2 }, { id: "c", codigo: "2020-1", indice: 4 }],
      [{ clave: "a", total: 100 }, { clave: "b", total: 100 }],
      [ret("x", 1, { periodoId: "a" }), ret("y", 1, { periodoId: "a" }), ret("z", 1, { periodoId: "b" })],
    );
    expect(filas.map((f) => f.periodo)).toEqual(["2019-1", "2019-2"]);
    expect(filas[0].tasa).toBe(2);
    expect(filas[1].tasa).toBe(1);
  });

  it("tasa anual equivalente a partir de dos semestrales", () => {
    expect(tasaAnualDesdeSemestrales(5, 5)).toBeCloseTo(9.75, 2);
  });
});

describe("causas y KPIs", () => {
  it("agrupa por categoría MEN y compara con la referencia nacional", () => {
    const retiros = [ret("a", 1), ret("b", 1), ret("c", 1, { causaNombre: "Bajo rendimiento académico", categoria: "ACADEMICA" }), ret("d", 1, { causaNombre: "Bajo rendimiento académico", categoria: "ACADEMICA" })];
    const r = resumenCausas(retiros, spadies);
    expect(r.topCausas[0].total).toBe(2);
    const socio = r.porCategoria.find((c) => c.categoria === "SOCIOECONOMICA")!;
    expect(socio.porcentaje).toBe(50);
    expect(socio.referenciaNacional).toBe(40);
  });

  it("KPIs: tasa acumulada y brecha frente al promedio nacional", () => {
    const estudiantes = [est("a", { estado: "DESERTOR" }), est("b", { estado: "GRADUADO" }), est("c"), est("d")];
    const k = calcularKpis(
      estudiantes,
      [{ periodo: "2025-1", matriculados: 100, desertores: 5, tasa: 5 }, { periodo: "2025-2", matriculados: 100, desertores: 5, tasa: 5 }],
      spadies,
    );
    expect(k.tasaAcumulada).toBe(25);
    expect(k.tasaAnual).toBeCloseTo(9.75, 2);
    expect(k.brechaAnualVsNacional).toBeCloseTo(9.75 - 7.82, 2);
  });
});
