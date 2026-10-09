import { describe, expect, it } from "vitest";
import { CalculadoraInstitucional, semestresNoCursados, type DesertorInstitucional, type EstudianteCohorte } from "@/services/institucional/CalculadoraInstitucional";

const desertor = (over: Partial<DesertorInstitucional> = {}): DesertorInstitucional => ({
  programa: "Derecho",
  cohorteAnio: 2020,
  anioRetiro: 2021,
  indiceRetiro: 6,
  semestreRetiro: 2,
  duracionSemestres: 10,
  valorSemestre: 4_000_000,
  municipio: "Pasto",
  departamento: "Nariño",
  perdidaIngresoVida: 100_000_000,
  ...over,
});
const est = (estado: EstudianteCohorte["estado"], cohorteAnio = 2018, plazoVencido = true): EstudianteCohorte => ({ estado, cohorteAnio, plazoVencido });

describe("semestresNoCursados", () => {
  it("es la duración menos el semestre de retiro, nunca negativa", () => {
    expect(semestresNoCursados({ duracionSemestres: 10, semestreRetiro: 2 })).toBe(8);
    expect(semestresNoCursados({ duracionSemestres: 10, semestreRetiro: 11 })).toBe(0);
  });
});

describe("CalculadoraInstitucional.calcular", () => {
  const calc = new CalculadoraInstitucional([16, 15], 10);
  const desertores = [
    desertor(), // 8 semestres x 4M = 32M
    desertor({ programa: "Medicina", duracionSemestres: 12, semestreRetiro: 4, valorSemestre: 16_000_000, indiceRetiro: 16, anioRetiro: 2025, municipio: "Ipiales" }), // 8 x 16M = 128M
    desertor({ semestreRetiro: 9, indiceRetiro: 15, anioRetiro: 2025, perdidaIngresoVida: 50_000_000 }), // 1 x 4M = 4M
  ];
  const estudiantes = [est("GRADUADO"), est("GRADUADO"), est("GRADUADO"), est("DESERTOR"), est("ACTIVO"), est("GRADUADO", 2024, false)];
  const r = calc.calcular(desertores, estudiantes);

  it("suma la matrícula no percibida y los semestres no cursados", () => {
    expect(r.ingresosNoPercibidos).toBe(164_000_000);
    expect(r.semestresNoCursados).toBe(17);
    expect(r.semestresCursadosSinTitulo).toBe(15);
  });

  it("agrupa por programa (mayor pérdida primero) y por año de retiro (cronológico)", () => {
    expect(r.porPrograma[0]).toEqual({ clave: "Medicina", desertores: 1, semestresNoCursados: 8, ingresosNoPercibidos: 128_000_000 });
    expect(r.porAnioRetiro.map((f) => f.clave)).toEqual(["2021", "2025"]);
  });

  it("la línea base anual usa solo los retiros de los dos últimos periodos cerrados", () => {
    expect(r.lineaBase.desertoresAnuales).toBe(2);
    expect(r.lineaBase.ingresosPerdidosAnuales).toBe(132_000_000);
    expect(r.lineaBase.perdidaRegionalAnual).toBe(150_000_000);
  });

  it("los indicadores de graduación ignoran cohortes cuyo plazo no ha vencido", () => {
    // Vencidos: 3 graduados, 1 desertor, 1 rezagado
    expect(r.lineaBase.tasaGraduacion).toBe(60);
    expect(r.lineaBase.tasaDesercionCohorte).toBe(20);
    expect(r.lineaBase.tasaRezago).toBe(20);
    expect(r.graduacion).toEqual([{ cohorte: 2018, estudiantes: 5, graduados: 3, desertores: 1, rezagados: 1, tasaGraduacion: 60, tasaDesercion: 20 }]);
  });

  it("la dimensión regional suma la pérdida de ingresos por municipio", () => {
    expect(r.regional[0]).toEqual({ municipio: "Pasto", departamento: "Nariño", desertores: 2, perdidaIngresoVida: 150_000_000 });
    expect(r.departamentos).toHaveLength(1);
    expect(r.perdidaRegionalTotal).toBe(250_000_000);
  });
});

describe("CalculadoraInstitucional.proyectar", () => {
  const base = { desertoresAnuales: 100, ingresosPerdidosAnuales: 2_000_000_000, perdidaRegionalAnual: 10_000_000_000, tasaDesercionAnual: 10, tasaGraduacion: 50, tasaDesercionCohorte: 40, tasaRezago: 10 };

  it("con 0 % no cambia nada", () => {
    const p = CalculadoraInstitucional.proyectar(base, 0);
    expect(p.estudiantesRetenidosAnio).toBe(0);
    expect(p.tasaGraduacionNueva).toBe(50);
  });

  it("calcula a mano una reducción del 20 %", () => {
    const p = CalculadoraInstitucional.proyectar(base, 20);
    expect(p.estudiantesRetenidosAnio).toBe(20);
    expect(p.ingresosRecuperadosAnio).toBe(400_000_000);
    expect(p.ingresosRecuperados5Anios).toBe(2_000_000_000);
    expect(p.perdidaRegionalEvitadaAnio).toBe(2_000_000_000);
    expect(p.tasaDesercionAnualNueva).toBe(8);
    // Rescatados: 40 % x 0,2 = 8 pp; se gradúan 50 / (50 + 10) = 5/6 => +6,7 pp
    expect(p.gananciaGraduacion).toBe(6.7);
    expect(p.tasaGraduacionNueva).toBe(56.7);
  });

  it("acota la reducción entre 0 y 100 %", () => {
    expect(CalculadoraInstitucional.proyectar(base, 150).reduccionPct).toBe(100);
    expect(CalculadoraInstitucional.proyectar(base, -5).reduccionPct).toBe(0);
  });
});
