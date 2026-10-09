import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EntrenadorLogistico, estandarizar, resolverSistema } from "@/services/riesgo/EntrenadorLogistico";
import { ModeloRiesgo, type DefinicionModelo } from "@/services/riesgo/ModeloRiesgo";
import { auc, calcularMetricas, esDePrueba } from "@/services/riesgo/metricas";
import { datosActuales, type RegistroEstudiante } from "@/services/riesgo/caracteristicas";

const exportado = JSON.parse(readFileSync(join(__dirname, "..", "ml", "modelo_riesgo.json"), "utf8")) as { definicion: DefinicionModelo };

function leerPanel() {
  const [cabecera, ...lineas] = readFileSync(join(__dirname, "..", "ml", "datos", "panel_entrenamiento.csv"), "utf8").trim().split("\n");
  const columnas = cabecera.split(",").map((c) => c.replace(/^"|"$/g, ""));
  const X: number[][] = [];
  const y: number[] = [];
  for (const l of lineas) {
    const v = l.split(",");
    y.push(Number(v[2]));
    X.push(v.slice(3).map(Number));
  }
  return { caracteristicas: columnas.slice(3), X, y };
}

describe("EntrenadorLogistico (Newton-Raphson con L2)", () => {
  it("resuelve sistemas lineales", () => {
    expect(resolverSistema([[2, 1], [1, 3]], [3, 5])).toEqual([expect.closeTo(0.8, 10), expect.closeTo(1.4, 10)]);
  });

  it("estandariza con desviación poblacional y deja en 0 las columnas constantes", () => {
    const { medias, desviaciones } = estandarizar([[1, 5], [3, 5]]);
    expect(medias).toEqual([2, 5]);
    expect(desviaciones).toEqual([1, 0]);
  });

  it("reproduce los coeficientes de scikit-learn con el mismo dataset", () => {
    const { caracteristicas, X, y } = leerPanel();
    expect(caracteristicas).toEqual(exportado.definicion.caracteristicas);
    const ajuste = new EntrenadorLogistico({ C: 1 }).ajustar(X, y);
    expect(ajuste.convergio).toBe(true);
    expect(ajuste.intercepto).toBeCloseTo(exportado.definicion.intercepto, 4);
    ajuste.coeficientes.forEach((c, i) => expect(c).toBeCloseTo(exportado.definicion.coeficientes[i], 4));
    ajuste.medias.forEach((m, i) => expect(m).toBeCloseTo(exportado.definicion.medias[i], 8));
  });

  it("umbrales: medio en la tasa base y alto en 2,5 veces", () => {
    expect(EntrenadorLogistico.umbrales(0.1145)).toEqual({ medio: 0.11, alto: 0.29 });
  });

  it("separa perfectamente datos linealmente separables sin divergir (gracias a L2)", () => {
    const X = [[0], [1], [2], [3], [4], [5]];
    const r = new EntrenadorLogistico().ajustar(X, [0, 0, 0, 1, 1, 1]);
    expect(r.convergio).toBe(true);
    expect(r.coeficientes[0]).toBeGreaterThan(0);
  });
});

describe("ModeloRiesgo", () => {
  const modelo = new ModeloRiesgo(exportado.definicion);
  const base: RegistroEstudiante = {
    id: "x", programa: "Derecho", estrato: 3, edadIngreso: 18, trabaja: false, horasTrabajoSemana: 0, financiacion: "RECURSOS_PROPIOS",
    estado: "ACTIVO", semestreActual: 4, semestreRetiro: null,
    notas: [
      { semestre: 3, promedio: 3.8, materiasPerdidas: 0, asistenciaPct: 92, periodoCerrado: true },
      { semestre: 4, promedio: 3.9, materiasPerdidas: 0, asistenciaPct: 94, periodoCerrado: false },
    ],
  };
  const enRiesgo: RegistroEstudiante = {
    ...base, estrato: 1, trabaja: true, horasTrabajoSemana: 40, semestreActual: 2,
    notas: [
      { semestre: 1, promedio: 3.4, materiasPerdidas: 1, asistenciaPct: 80, periodoCerrado: true },
      { semestre: 2, promedio: 2.4, materiasPerdidas: 4, asistenciaPct: 62, periodoCerrado: false },
    ],
  };

  it("la explicación es exacta: intercepto + suma de aportes = logit", () => {
    const p = modelo.predecir(datosActuales(enRiesgo)!);
    const logit = exportado.definicion.intercepto + p.factores.reduce((a, f) => a + f.aporte, 0);
    expect(1 / (1 + Math.exp(-logit))).toBeCloseTo(p.probabilidad, 12);
  });

  it("un estudiante con bajo rendimiento, que trabaja y está en primer año tiene riesgo ALTO", () => {
    const p = modelo.predecir(datosActuales(enRiesgo)!);
    expect(p.nivel).toBe("ALTO");
    expect(p.puntaje).toBeGreaterThan(40);
    const principales = ModeloRiesgo.principalesRiesgos(p).map((f) => f.clave);
    expect(principales).toContain("promedio");
  });

  it("un estudiante con buen rendimiento y sin trabajar tiene riesgo BAJO", () => {
    const p = modelo.predecir(datosActuales(base)!);
    expect(p.nivel).toBe("BAJO");
    expect(p.probabilidad).toBeLessThan(p.probabilidadPromedio);
  });

  it("el promedio alto reduce el riesgo (coeficiente negativo)", () => {
    const i = exportado.definicion.caracteristicas.indexOf("promedio");
    expect(exportado.definicion.coeficientes[i]).toBeLessThan(0);
  });

  it("describe factores en lenguaje claro", () => {
    const p = modelo.predecir(datosActuales(enRiesgo)!);
    const prom = p.factores.find((f) => f.clave === "promedio")!;
    expect(ModeloRiesgo.describir(prom)).toMatch(/^Promedio del semestre: 2,4 \(promedio 3,[0-9]+\)$/);
    expect(ModeloRiesgo.describir(p.factores.find((f) => f.clave === "fin_beca")!)).toBe("Tiene beca: No");
  });

  it("rechaza definiciones inconsistentes", () => {
    expect(() => new ModeloRiesgo({ ...exportado.definicion, coeficientes: [1] })).toThrow();
    expect(() => new ModeloRiesgo({ ...exportado.definicion, umbrales: { medio: 0.5, alto: 0.2 } })).toThrow();
  });
});

describe("métricas", () => {
  it("AUC = 1 con separación perfecta, 0,5 con empates totales", () => {
    expect(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1])).toBe(1);
    expect(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1])).toBe(0.5);
  });

  it("matriz de confusión y precisión en el umbral alto", () => {
    const m = calcularMetricas([0.9, 0.8, 0.1, 0.4], [1, 0, 0, 1], 0.5);
    expect(m.matrizConfusion).toEqual({ vp: 1, fp: 1, vn: 1, fn: 1 });
    expect(m.precisionAlto).toBe(0.5);
  });

  it("la división por estudiante es determinista y cercana al 20%", () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `est-${i}`);
    const prueba = ids.filter((id) => esDePrueba(id)).length / ids.length;
    expect(prueba).toBeGreaterThan(0.17);
    expect(prueba).toBeLessThan(0.23);
    expect(esDePrueba("abc")).toBe(esDePrueba("abc"));
  });
});

describe("ModeloRiesgo.etiquetaCorta", () => {
  it("muestra el valor del estudiante para que la explicación no confunda", () => {
    const base = { clave: "x", promedio: 0.2, aporte: 0.1, aporteRelativo: 0 } as const;
    expect(ModeloRiesgo.etiquetaCorta({ ...base, etiqueta: "Tiene beca", formato: "binario", valor: 0 } as never)).toBe("Tiene beca: no");
    expect(ModeloRiesgo.etiquetaCorta({ ...base, etiqueta: "Tiene beca", formato: "binario", valor: 1 } as never)).toBe("Tiene beca: sí");
    expect(ModeloRiesgo.etiquetaCorta({ ...base, etiqueta: "Promedio del semestre", formato: "nota", valor: 1.49, promedio: 3.5 } as never)).toBe("Promedio del semestre: 1,49");
  });
});
