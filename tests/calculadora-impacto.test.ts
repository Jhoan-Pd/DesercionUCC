import { describe, expect, it } from "vitest";
import { CalculadoraImpacto } from "@/services/impacto/CalculadoraImpacto";
import type { EntradaImpacto } from "@/services/impacto/tipos";
import { ENTRADA_PRUEBA, PARAMETROS_PRUEBA } from "./fixtures";

const calc = () => new CalculadoraImpacto(PARAMETROS_PRUEBA);
const con = (cambios: Partial<EntradaImpacto>): EntradaImpacto => ({ ...ENTRADA_PRUEBA, ...cambios });

describe("CalculadoraImpacto — dinero invertido", () => {
  it("suma matrícula, transporte, materiales y sostenimiento de los semestres cursados", () => {
    const inv = calc().calcularInversion(ENTRADA_PRUEBA);
    expect(inv.matricula).toBe(4_300_000 * 4);
    expect(inv.transporte).toBe(120_000 * 6 * 4);
    expect(inv.materiales).toBe(350_000 * 4);
    expect(inv.sostenimiento).toBe(650_000 * 6 * 4);
    expect(inv.total).toBe(inv.matricula + inv.transporte + inv.materiales + inv.sostenimiento);
  });

  it("usa la matrícula realmente pagada cuando se conoce", () => {
    const inv = calc().calcularInversion(con({ matriculaTotalPagada: 15_000_000 }));
    expect(inv.matricula).toBe(15_000_000);
  });

  it("reparte la matrícula entre deuda, beca y recursos propios", () => {
    const icetex = calc().calcularInversion(ENTRADA_PRUEBA); // 80% ICETEX
    expect(icetex.matriculaConDeuda).toBeCloseTo(icetex.matricula * 0.8);
    expect(icetex.matriculaConBeca).toBe(0);
    expect(icetex.aporteDirecto).toBeCloseTo(icetex.total - icetex.matriculaConDeuda);

    const beca = calc().calcularInversion(con({ financiacion: { ...ENTRADA_PRUEBA.financiacion, tipo: "BECA", porcentajeFinanciado: 50 } }));
    expect(beca.matriculaConBeca).toBeCloseTo(beca.matricula * 0.5);
    expect(beca.matriculaConDeuda).toBe(0);
  });

  it("con cero semestres cursados la inversión es cero", () => {
    expect(calc().calcularInversion(con({ semestresCursados: 0 })).total).toBe(0);
  });
});

describe("CalculadoraImpacto — deuda", () => {
  it("la cuota del sistema francés coincide con un valor conocido", () => {
    // 10.000.000 a 12% EA (0,9489% mensual), 12 meses => cuota ≈ 885.621 (verificado con Python)
    expect(CalculadoraImpacto.cuotaFrancesa(10_000_000, 0.12, 12)).toBeCloseTo(885_621, -1);
  });

  it("con tasa 0 la cuota es saldo / plazo", () => {
    expect(CalculadoraImpacto.cuotaFrancesa(6_000_000, 0, 60)).toBe(100_000);
  });

  it("sin deuda (recursos propios) todo es cero", () => {
    const d = calc().calcularDeuda(con({ financiacion: { tipo: "RECURSOS_PROPIOS", porcentajeFinanciado: 100, tasaEA: 0, plazoMeses: 0 } }));
    expect(d.tieneDeuda).toBe(false);
    expect(d.cuotaMensual).toBe(0);
    expect(d.totalIntereses).toBe(0);
  });

  it("estima el saldo desde la matrícula financiada y calcula intereses positivos", () => {
    const d = calc().calcularDeuda(ENTRADA_PRUEBA);
    expect(d.saldo).toBeCloseTo(4_300_000 * 4 * 0.8);
    expect(d.totalIntereses).toBeGreaterThan(0);
    expect(d.totalAPagar).toBeCloseTo(d.saldo + d.totalIntereses);
  });

  it("la cuota pesa más sobre el ingreso sin título que con título", () => {
    const d = calc().calcularDeuda(ENTRADA_PRUEBA);
    expect(d.cuotaSobreIngresoSinTitulo).toBeGreaterThan(d.cuotaSobreIngresoConTitulo);
  });

  it("respeta un saldo de deuda informado explícitamente", () => {
    const d = calc().calcularDeuda(con({ financiacion: { ...ENTRADA_PRUEBA.financiacion, saldoDeuda: 5_000_000 } }));
    expect(d.saldo).toBe(5_000_000);
  });
});

describe("CalculadoraImpacto — costo de oportunidad", () => {
  const res = calc().calcularCostoOportunidad(ENTRADA_PRUEBA);

  it("devuelve los horizontes de 10, 20 y 30 años", () => {
    expect(res.horizontes.map((h) => h.anios)).toEqual([10, 20, 30]);
  });

  it("la brecha de ingresos crece con el horizonte", () => {
    const [h10, h20, h30] = res.horizontes;
    expect(h20.vpnDiferenciaNeta).toBeGreaterThan(h10.vpnDiferenciaNeta);
    expect(h30.vpnDiferenciaNeta).toBeGreaterThan(h20.vpnDiferenciaNeta);
  });

  it("a 20 años graduarse supera a retirarse con un salario profesional mayor al de bachiller", () => {
    expect(res.horizontes[1].vpnDiferenciaNeta).toBeGreaterThan(0);
    expect(res.puntoEquilibrioAnios).not.toBeNull();
  });

  it("el valor presente es menor que la suma nominal", () => {
    const h = res.horizontes[1];
    expect(h.vpnProfesional).toBeLessThan(h.ingresoProfesionalNominal);
  });

  it("la diferencia neta es menor que la diferencia de ingresos (porque terminar cuesta dinero)", () => {
    const h = res.horizontes[0];
    expect(h.vpnDiferenciaNeta).toBeLessThan(h.vpnDiferenciaIngresos);
  });

  it("si el título no paga más que la alternativa, nunca hay equilibrio", () => {
    const r = calc().calcularCostoOportunidad(con({ salarioProfesionalMensual: 1_000_000 }));
    expect(r.puntoEquilibrioAnios).toBeNull();
    expect(r.horizontes[2].vpnDiferenciaNeta).toBeLessThan(0);
  });

  it("un alternativo técnico (mayor ingreso que bachiller) reduce la brecha", () => {
    const bachiller = calc().calcularCostoOportunidad(ENTRADA_PRUEBA).horizontes[1].vpnDiferenciaNeta;
    const tecnico = calc().calcularCostoOportunidad(con({ nivelAlternativo: "TECNICO" })).horizontes[1].vpnDiferenciaNeta;
    expect(tecnico).toBeLessThan(bachiller);
  });

  it("con tasa de descuento 0, el VPN iguala la suma nominal", () => {
    const sinDescuento = new CalculadoraImpacto({ ...PARAMETROS_PRUEBA, tasaDescuento: 0 });
    const h = sinDescuento.calcularCostoOportunidad(ENTRADA_PRUEBA).horizontes[0];
    expect(h.vpnProfesional).toBeCloseTo(h.ingresoProfesionalNominal, 3);
    expect(h.vpnAlternativo).toBeCloseTo(h.ingresoAlternativoNominal, 3);
  });

  it("calcula a mano el ingreso alternativo a 10 años sin crecimiento ni descuento", () => {
    const simple = new CalculadoraImpacto({
      ...PARAMETROS_PRUEBA,
      tasaDescuento: 0,
      crecimientoAlternativo: { BACHILLER: 0, TECNICO: 0, TECNOLOGO: 0 },
    });
    const h = simple.calcularCostoOportunidad(ENTRADA_PRUEBA).horizontes[0];
    expect(h.ingresoAlternativoNominal).toBeCloseTo(1_750_905 * 12 * 10, 0);
  });
});

describe("CalculadoraImpacto — escenarios", () => {
  const escenarios = calc().compararEscenarios(ENTRADA_PRUEBA);
  const por = (tipo: string) => escenarios.find((e) => e.tipo === tipo)!;

  it("incluye los cinco escenarios", () => {
    expect(escenarios.map((e) => e.tipo).sort()).toEqual(["APLAZAR", "APOYO_FINANCIERO", "CONTINUAR", "NOCTURNA_VIRTUAL", "RETIRARSE"]);
  });

  it("retirarse es la línea base: ventaja 0", () => {
    expect(por("RETIRARSE").ventajaVsRetiro[20]).toBe(0);
    expect(por("RETIRARSE").mesesHastaTitulo).toBeNull();
  });

  it("el apoyo financiero mejora el resultado de continuar (cuesta menos)", () => {
    expect(por("APOYO_FINANCIERO").ventajaVsRetiro[10]).toBeGreaterThan(por("CONTINUAR").ventajaVsRetiro[10]);
    expect(por("APOYO_FINANCIERO").costoRestante).toBeLessThan(por("CONTINUAR").costoRestante);
  });

  it("aplazar retrasa el título exactamente el número de semestres aplazados", () => {
    expect((por("APLAZAR").mesesHastaTitulo ?? 0) - (por("CONTINUAR").mesesHastaTitulo ?? 0)).toBe(6);
  });

  it("la jornada nocturna/virtual alarga la carrera", () => {
    expect(por("NOCTURNA_VIRTUAL").mesesHastaTitulo!).toBeGreaterThan(por("CONTINUAR").mesesHastaTitulo!);
  });

  it("todos los escenarios con título tienen una advertencia o aviso útil", () => {
    expect(por("RETIRARSE").advertencias.join(" ")).toMatch(/deuda/i);
    expect(por("APLAZAR").advertencias.length).toBeGreaterThan(0);
  });
});

describe("CalculadoraImpacto — resultado completo", () => {
  it("genera una serie anual de 0 a 30 años con cada escenario", () => {
    const r = calc().calcular(ENTRADA_PRUEBA);
    expect(r.serieVentaja).toHaveLength(31);
    expect(r.serieVentaja[0].CONTINUAR).toBe(0);
    expect(r.serieVentaja[30].CONTINUAR).toBeGreaterThan(0);
  });

  it("redacta una conclusión mencionando el horizonte de 20 años", () => {
    expect(calc().calcular(ENTRADA_PRUEBA).conclusion).toMatch(/20 años/);
  });

  it("si ya terminó todos los semestres no hay costo restante", () => {
    const r = calc().calcular(con({ semestresCursados: 10 }));
    expect(r.semestresRestantes).toBe(0);
    expect(r.escenarios.find((e) => e.tipo === "CONTINUAR")!.costoRestante).toBe(0);
  });

  it("rechaza entradas inválidas", () => {
    expect(() => calc().calcular(con({ semestresCursados: 11 }))).toThrow();
    expect(() => calc().calcular(con({ programa: { ...ENTRADA_PRUEBA.programa, duracionSemestres: 0 } }))).toThrow();
  });
});

describe("CalculadoraImpacto — punto de equilibrio", () => {
  it("aplazar solo empata con retirarse mientras trabaja: el equilibrio llega después de estudiar, no en el mes 0", () => {
    const e = calc().compararEscenarios(ENTRADA_PRUEBA).find((x) => x.tipo === "APLAZAR")!;
    expect(e.puntoEquilibrioAnios).toBeGreaterThan(5);
  });
});
