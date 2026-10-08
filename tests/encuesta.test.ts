import { describe, expect, it } from "vitest";
import { EvaluadorEncuesta } from "@/services/encuesta/EvaluadorEncuesta";
import { PREGUNTAS } from "@/services/encuesta/preguntas";

/** Respuestas con riesgo 0 o 1 en todas las preguntas */
const extremo = (riesgo: 0 | 1) =>
  Object.fromEntries(PREGUNTAS.map((p) => [p.clave, riesgo === 1 ? (p.invertida ? 1 : 5) : p.invertida ? 5 : 1]));

describe("EvaluadorEncuesta", () => {
  it("sin señales de riesgo: puntaje 0 y nivel BAJO", () => {
    const r = EvaluadorEncuesta.evaluar(extremo(0));
    expect(r.puntaje).toBe(0);
    expect(r.nivel).toBe("BAJO");
    expect(r.intencionRetiro).toBe(false);
  });

  it("todas las señales de riesgo: 100 y ALTO", () => {
    const r = EvaluadorEncuesta.evaluar(extremo(1));
    expect(r.puntaje).toBe(100);
    expect(r.nivel).toBe("ALTO");
    expect(Object.values(r.puntajesDimension).every((v) => v === 100)).toBe(true);
  });

  it("respuestas neutras (3) dan 50 en todas las dimensiones => MEDIO", () => {
    const r = EvaluadorEncuesta.evaluar(Object.fromEntries(PREGUNTAS.map((p) => [p.clave, 3])));
    expect(r.puntaje).toBe(50);
    expect(r.nivel).toBe("MEDIO");
  });

  it("las preguntas invertidas se puntúan al revés", () => {
    const base = extremo(0);
    const r = EvaluadorEncuesta.evaluar({ ...base, e1: 1 }); // "tengo recursos para pagar": totalmente en desacuerdo
    expect(r.puntajesDimension.ECONOMICA).toBeGreaterThan(0);
  });

  it("declarar intención de retiro (5) eleva el nivel a ALTO aunque el resto sea bajo", () => {
    const r = EvaluadorEncuesta.evaluar({ ...extremo(0), m2: 5 });
    expect(r.puntaje).toBeLessThan(EvaluadorEncuesta.UMBRAL_MEDIO);
    expect(r.nivel).toBe("ALTO");
    expect(r.intencionRetiro).toBe(true);
  });

  it("intención 4 eleva de BAJO a MEDIO", () => {
    expect(EvaluadorEncuesta.evaluar({ ...extremo(0), m2: 4 }).nivel).toBe("MEDIO");
  });

  it("recomienda recursos de las dimensiones con riesgo y siempre al menos uno", () => {
    const soloEconomica = { ...extremo(0), e1: 1, e2: 5, e3: 5, e4: 1 };
    const r = EvaluadorEncuesta.evaluar(soloEconomica);
    expect(r.dimensionesCriticas[0]).toBe("ECONOMICA");
    expect(r.recursos.every((x) => x.dimension === "ECONOMICA")).toBe(true);
    expect(EvaluadorEncuesta.evaluar(extremo(0)).recursos.length).toBeGreaterThan(0);
  });

  it("rechaza respuestas incompletas o fuera de escala", () => {
    expect(() => EvaluadorEncuesta.evaluar({ e1: 3 })).toThrow(/Falta responder/);
    expect(() => EvaluadorEncuesta.evaluar({ ...extremo(0), a1: 7 })).toThrow(/inválida/);
    expect(EvaluadorEncuesta.validar(extremo(0))).toEqual([]);
  });
});
