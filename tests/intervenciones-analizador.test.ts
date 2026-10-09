import { describe, expect, it } from "vitest";
import { AnalizadorIntervenciones, type Observacion } from "@/services/intervenciones/AnalizadorIntervenciones";

/** Crea n observaciones iguales, de las cuales `permanecen` permanecieron */
function lote(n: number, permanecen: number, base: Omit<Observacion, "permanecio">): Observacion[] {
  return Array.from({ length: n }, (_, i) => ({ ...base, permanecio: i < permanecen }));
}

describe("AnalizadorIntervenciones", () => {
  const analizador = new AnalizadorIntervenciones(5, 0.11);

  it("sin intervenciones lo indica y no calcula efecto", () => {
    const r = analizador.analizar(lote(20, 18, { probabilidad: 0.08, intervenido: false, tipo: null, periodo: "2023-1" }));
    expect(r.general.tratados.n).toBe(0);
    expect(r.general.efectoAjustado).toBeNull();
    expect(r.interpretacion[0]).toMatch(/Aún no hay intervenciones/);
  });

  it("corrige el sesgo de selección: la comparación ingenua es negativa pero el efecto ajustado es positivo", () => {
    // Bienestar interviene sobre todo a estudiantes de ALTO riesgo (que permanecen menos),
    // pero dentro de cada franja los intervenidos permanecen MÁS.
    const obs = [
      // Franja baja (< 5 %): 10 intervenidos (90 %) vs 100 controles (85 %)
      ...lote(10, 9, { probabilidad: 0.03, intervenido: true, tipo: "TUTORIA", periodo: "2023-1" }),
      ...lote(100, 85, { probabilidad: 0.03, intervenido: false, tipo: null, periodo: "2023-1" }),
      // Franja alta (30-45 %): 100 intervenidos (60 %) vs 20 controles (40 %)
      ...lote(100, 60, { probabilidad: 0.35, intervenido: true, tipo: "APOYO_ECONOMICO", periodo: "2023-1" }),
      ...lote(20, 8, { probabilidad: 0.35, intervenido: false, tipo: null, periodo: "2023-1" }),
    ];
    const r = analizador.analizar(obs);
    // Ingenua: intervenidos 69/110 = 62,7 % vs controles 93/120 = 77,5 % => negativa
    expect(r.general.diferenciaIngenua).toBeLessThan(0);
    // Ajustada (ATT): (10*5 + 100*20) / 110 = 18,6 pp
    expect(r.general.efectoAjustado).toBeCloseTo(18.6, 1);
    expect(r.general.tratadosComparables).toBe(110);
    expect(r.interpretacion.join(" ")).toMatch(/injusta/);
  });

  it("calcula el intervalo de confianza con la aproximación normal", () => {
    // Una sola franja: tratados 80/100, controles 60/100 => diferencia 20 pp
    // EE = sqrt(0,8*0,2/100 + 0,6*0,4/100) = 0,0632 => IC = 20 ± 12,4
    const obs = [
      ...lote(100, 80, { probabilidad: 0.15, intervenido: true, tipo: "TUTORIA", periodo: "2024-1" }),
      ...lote(100, 60, { probabilidad: 0.15, intervenido: false, tipo: null, periodo: "2024-1" }),
    ];
    const r = analizador.analizar(obs);
    expect(r.general.efectoAjustado).toBe(20);
    expect(r.general.ic95![0]).toBeCloseTo(7.6, 1);
    expect(r.general.ic95![1]).toBeCloseTo(32.4, 1);
    expect(r.general.significativo).toBe(true);
  });

  it("no es significativo cuando el intervalo cruza el cero", () => {
    const obs = [
      ...lote(10, 7, { probabilidad: 0.15, intervenido: true, tipo: "TUTORIA", periodo: "2024-1" }),
      ...lote(10, 6, { probabilidad: 0.15, intervenido: false, tipo: null, periodo: "2024-1" }),
    ];
    const r = analizador.analizar(obs);
    expect(r.general.efectoAjustado).toBe(10);
    expect(r.general.significativo).toBe(false);
    expect(r.interpretacion.join(" ")).toMatch(/no es concluyente|incluye el cero/);
  });

  it("descarta franjas con muy pocos controles o tratados", () => {
    const obs = [
      ...lote(3, 3, { probabilidad: 0.5, intervenido: true, tipo: "TUTORIA", periodo: "2024-1" }), // menos del mínimo
      ...lote(50, 20, { probabilidad: 0.5, intervenido: false, tipo: null, periodo: "2024-1" }),
    ];
    const r = analizador.analizar(obs);
    expect(r.general.efectoAjustado).toBeNull();
    expect(r.general.estratos.find((e) => e.franja === "≥ 45 %")!.diferencia).not.toBeNull();
  });

  it("separa el efecto por tipo de intervención", () => {
    const obs = [
      ...lote(40, 36, { probabilidad: 0.25, intervenido: true, tipo: "APOYO_ECONOMICO", periodo: "2024-1" }),
      ...lote(40, 28, { probabilidad: 0.25, intervenido: true, tipo: "TUTORIA", periodo: "2024-1" }),
      ...lote(80, 48, { probabilidad: 0.25, intervenido: false, tipo: null, periodo: "2024-1" }),
    ];
    const r = analizador.analizar(obs);
    const apoyo = r.porTipo.find((t) => t.tipo === "APOYO_ECONOMICO")!;
    const tutoria = r.porTipo.find((t) => t.tipo === "TUTORIA")!;
    expect(apoyo.efectoAjustado).toBe(30); // 90 % vs 60 %
    expect(tutoria.efectoAjustado).toBe(10); // 70 % vs 60 %
    expect(r.interpretacion.join(" ")).toMatch(/mayor efecto estimado es el apoyo económico/);
  });

  it("mide la cobertura: en riesgo e intervenidos por periodo", () => {
    const obs = [
      ...lote(10, 5, { probabilidad: 0.3, intervenido: true, tipo: "TUTORIA", periodo: "2024-2" }),
      ...lote(30, 20, { probabilidad: 0.3, intervenido: false, tipo: null, periodo: "2024-2" }),
      ...lote(50, 49, { probabilidad: 0.02, intervenido: false, tipo: null, periodo: "2024-2" }), // no están en riesgo
      ...lote(5, 4, { probabilidad: 0.2, intervenido: true, tipo: "TUTORIA", periodo: "2024-1" }),
    ];
    const cobertura = analizador.cobertura(obs);
    expect(cobertura.map((c) => c.periodo)).toEqual(["2024-1", "2024-2"]);
    expect(cobertura[1]).toEqual({ periodo: "2024-2", enRiesgo: 40, intervenidos: 10, cobertura: 25 });
  });
});
