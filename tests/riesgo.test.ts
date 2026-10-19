import { describe, expect, it } from "vitest";
import { REGLAS, coberturaFactores, nivelPorPuntaje, puntajePorFactores } from "@/services/riesgo/factores";
import { MINIMO_ENTRENAMIENTO, entrenarModelo, predecirConModelo, variablesUtilizables, type RegistroConResultado } from "@/services/riesgo/modelo";
import { auc } from "@/services/riesgo/metricas";

describe("Puntaje por factores", () => {
  it("los pesos suman 100", () => {
    expect(REGLAS.reduce((s, r) => s + r.maximo, 0)).toBe(100);
  });

  it("un estudiante sin señales de alerta tiene riesgo bajo y 0 puntos", () => {
    const r = puntajePorFactores({ semestre: 6, promedio: 4.1, materiasPerdidas: 0, asistencia: 95, estrato: 3, trabaja: false, apoyoFinanciero: true, moraMatricula: false, puntajeSaber11: 320 });
    expect(r).toMatchObject({ puntaje: 0, nivel: "BAJO", metodo: "FACTORES", factores: [], faltantes: [] });
  });

  it("promedio bajo y dos materias perdidas ya es riesgo ALTO, con el detalle de cada factor", () => {
    const r = puntajePorFactores({ semestre: 4, promedio: 2.8, materiasPerdidas: 2 });
    expect(r.puntaje).toBe(45);
    expect(r.nivel).toBe("ALTO");
    expect(r.factores.map((f) => f.clave)).toEqual(["promedio", "materiasPerdidas"]);
    expect(r.factores[0].detalle).toContain("2,8");
  });

  it("los datos que faltan no suman ni se inventan: se reportan", () => {
    const r = puntajePorFactores({ semestre: 1 });
    expect(r.puntaje).toBe(8);
    expect(r.faltantes).toEqual(expect.arrayContaining(["promedio", "materiasPerdidas", "asistencia", "moraMatricula", "puntajeSaber11", "trabaja", "estrato", "apoyoFinanciero"]));
    expect(coberturaFactores({ semestre: 1 })).toBeCloseTo(0.08);
  });

  it("estrato bajo solo suma si además no tiene apoyo financiero", () => {
    expect(puntajePorFactores({ semestre: 5, estrato: 1, apoyoFinanciero: true }).puntaje).toBe(0);
    expect(puntajePorFactores({ semestre: 5, estrato: 2, apoyoFinanciero: false }).puntaje).toBe(5);
  });

  it("el caso más grave llega a 100 y los umbrales son 20 y 45", () => {
    const r = puntajePorFactores({ semestre: 1, promedio: 2, materiasPerdidas: 3, asistencia: 50, estrato: 1, trabaja: true, apoyoFinanciero: false, moraMatricula: true, puntajeSaber11: 200 });
    expect(r.puntaje).toBe(100);
    expect([nivelPorPuntaje(19), nivelPorPuntaje(20), nivelPorPuntaje(44), nivelPorPuntaje(45)]).toEqual(["BAJO", "MEDIO", "MEDIO", "ALTO"]);
  });
});

/** Generador determinista SOLO para probar el algoritmo (nunca se muestra en la aplicación) */
function registrosDePrueba(n: number, semilla = 7): RegistroConResultado[] {
  let s = semilla;
  const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: n }, (_, i) => {
    const promedio = 2 + azar() * 2.8;
    const materiasPerdidas = Math.floor(azar() * 4);
    const moraMatricula = azar() < 0.3;
    const logit = -1 - 2.2 * (promedio - 3.4) + 0.6 * materiasPerdidas + 1.2 * (moraMatricula ? 1 : 0);
    const retirado = azar() < 1 / (1 + Math.exp(-logit));
    return { codigo: `E${i}`, retirado, datos: { semestre: 1 + Math.floor(azar() * 10), promedio, materiasPerdidas, moraMatricula, asistencia: i % 7 === 0 ? null : 60 + azar() * 40 } };
  });
}

describe("Modelo entrenado con estudiantes que ya tienen resultado", () => {
  it(`no entrena con menos de ${MINIMO_ENTRENAMIENTO} estudiantes con resultado`, () => {
    const r = entrenarModelo(registrosDePrueba(120), "v1");
    expect(r.estado).toBe("INSUFICIENTE");
  });

  it("aprende la relación real de los datos, la evalúa fuera de muestra y se puede activar", () => {
    const datos = registrosDePrueba(900);
    const r = entrenarModelo(datos, "v1", new Date("2026-10-19T00:00:00Z"));
    expect(r.estado).toBe("ENTRENADO");
    if (r.estado !== "ENTRENADO") return;
    expect(r.activable).toBe(true);
    expect(r.metricas.auc).toBeGreaterThan(0.7);
    expect(r.metricas.estudiantesPrueba).toBeGreaterThan(100);
    // Coeficientes con el signo esperado (estandarizados)
    const coef = Object.fromEntries(r.definicion.variables.map((v, i) => [v, r.definicion.coeficientes[i]]));
    expect(coef.promedio).toBeLessThan(0);
    expect(coef.materiasPerdidas).toBeGreaterThan(0);
    expect(coef.moraMatricula).toBeGreaterThan(0);

    const alto = predecirConModelo(r.definicion, { semestre: 2, promedio: 2.1, materiasPerdidas: 3, moraMatricula: true, asistencia: 70 });
    const bajo = predecirConModelo(r.definicion, { semestre: 8, promedio: 4.5, materiasPerdidas: 0, moraMatricula: false, asistencia: 95 });
    expect(alto.puntaje).toBeGreaterThan(bajo.puntaje);
    expect(alto.metodo).toBe("MODELO");
    expect(alto.factores[0].clave).toBe("promedio");
    expect(alto.factores.every((f) => f.puntos >= 1)).toBe(true);
    // Los puntos reparten el riesgo por encima del estudiante promedio (salvo redondeo)
    const promedio = Math.round(100 / (1 + Math.exp(-r.definicion.intercepto)));
    const suma = alto.factores.reduce((s, f) => s + f.puntos, 0);
    expect(Math.abs(suma - (alto.puntaje - promedio))).toBeLessThanOrEqual(alto.factores.length);
    expect(alto.factores[0].detalle).toMatch(/frente a .* en promedio en la UCC/);
  });

  it("no usa variables que casi nadie trae ni constantes", () => {
    const datos = registrosDePrueba(300).map((r, i) => ({ ...r, datos: { ...r.datos, estrato: i < 30 ? 2 : null, edad: 20 } }));
    const vars = variablesUtilizables(datos);
    expect(vars).not.toContain("estrato");
    expect(vars).not.toContain("edad");
    expect(vars).toContain("promedio");
  });

  it("un dato faltante al predecir se reporta y no cambia el riesgo frente al promedio", () => {
    const r = entrenarModelo(registrosDePrueba(900), "v1");
    if (r.estado !== "ENTRENADO") throw new Error("debía entrenar");
    const p = predecirConModelo(r.definicion, { semestre: 3 });
    expect(p.faltantes).toEqual(expect.arrayContaining(["promedio", "materiasPerdidas"]));
    expect(p.factores.find((f) => f.clave === "promedio")).toBeUndefined();
  });

  it("si los datos no tienen relación con el resultado, NO se activa", () => {
    const datos = registrosDePrueba(900).map((r, i) => ({ ...r, retirado: i % 2 === 0 }));
    const r = entrenarModelo(datos, "v1");
    expect(r.estado === "ENTRENADO" && r.activable).toBe(false);
  });

  it("AUC: 1 cuando ordena perfecto y 0,5 con empates", () => {
    expect(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1])).toBe(1);
    expect(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1])).toBe(0.5);
  });
});
