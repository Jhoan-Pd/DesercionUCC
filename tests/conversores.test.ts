import { describe, expect, it } from "vitest";
import { construirParametrosCalculadora, construirReferenciasSpadies } from "@/services/parametros/conversores";

describe("construirParametrosCalculadora", () => {
  it("convierte porcentajes a fracciones", () => {
    const p = construirParametrosCalculadora({ tasa_descuento: 8, crecimiento_real_profesional: 4, nocturna_descuento_matricula: 15, apoyo_porcentaje_beca: 60 });
    expect(p.tasaDescuento).toBeCloseTo(0.08);
    expect(p.crecimientoProfesional).toBeCloseTo(0.04);
    expect(p.nocturnaDescuentoMatricula).toBeCloseTo(0.15);
    expect(p.apoyoPorcentaje).toBeCloseTo(0.6);
  });

  it("usa valores por defecto cuando falta un parámetro en la BD", () => {
    const p = construirParametrosCalculadora({});
    expect(p.salarioAlternativo.BACHILLER).toBe(1_750_905);
    expect(p.horizontes).toEqual([10, 20, 30]);
  });

  it("los valores de la BD tienen prioridad", () => {
    expect(construirParametrosCalculadora({ salario_bachiller_mensual: 2_000_000 }).salarioAlternativo.BACHILLER).toBe(2_000_000);
  });
});

describe("construirReferenciasSpadies", () => {
  it("trae la curva nacional de 10 semestres", () => {
    const r = construirReferenciasSpadies({});
    expect(r.cohorte).toHaveLength(10);
    expect(r.cohorte[9]).toBe(36.7);
    expect(r.cohorte[0]).toBe(9.7);
  });

  it("permite que el ADMIN cambie los valores", () => {
    expect(construirReferenciasSpadies({ spadies_cohorte_sem3: 20 }).cohorte[2]).toBe(20);
  });
});

import { formatoCOPCompacto } from "@/lib/utils";

describe("formatoCOPCompacto", () => {
  it("abrevia en millones y miles", () => {
    expect(formatoCOPCompacto(1_200_000_000)).toBe("$1.200 M");
    expect(formatoCOPCompacto(2_500_000)).toBe("$2,5 M");
    expect(formatoCOPCompacto(350_000)).toBe("$350 mil");
    expect(formatoCOPCompacto(-250_000_000)).toBe("-$250 M");
  });
});
