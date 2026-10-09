import { describe, expect, it } from "vitest";
import { contenidoImpactoInstitucional, contenidoIntervenciones, contenidoRiesgo, type FilaRiesgoAnonima } from "@/services/reportes/contenido";
import type { EfectividadIntervenciones } from "@/services/intervenciones/ServicioIntervenciones";
import type { ImpactoInstitucional } from "@/services/institucional/ServicioImpactoInstitucional";

const ctx = { generadoEn: new Date("2026-10-09T15:00:00Z"), generadoPorRol: "Bienestar Universitario", filtros: [] };

const fila = (i: number, nivel: "ALTO" | "MEDIO", intervenciones = 0): FilaRiesgoAnonima => ({
  hashAnonimo: `EST-${i.toString(16).padStart(10, "0")}`,
  programa: "Psicología",
  semestre: 3,
  puntaje: 80 - i,
  nivel,
  factores: ["Promedio bajo", "Trabaja muchas horas"],
  alertasAbiertas: 1,
  intervencionesEnCurso: intervenciones,
});

describe("contenidoRiesgo", () => {
  const filas = [fila(1, "ALTO"), fila(2, "ALTO", 1), fila(3, "MEDIO")];
  const reporte = contenidoRiesgo(filas, { ALTO: 2, MEDIO: 1, BAJO: 40, periodo: "2026-2", modelo: "sklearn-20261009" }, ctx);

  it("la fila de riesgo no tiene campos para datos personales", () => {
    const claves = Object.keys(filas[0]);
    for (const prohibida of ["nombre", "nombres", "apellidos", "codigo", "email", "documento"]) expect(claves).not.toContain(prohibida);
  });

  it("lista solo los estudiantes recibidos, con el hash anónimo en la primera columna", () => {
    const tabla = reporte.secciones[1].tabla!;
    expect(tabla.filas).toHaveLength(3);
    expect(tabla.filas.map((f) => f[0])).toEqual(filas.map((f) => f.hashAnonimo));
    expect(tabla.columnas[0].titulo).toBe("Código anónimo");
  });

  it("cuenta los casos de riesgo alto sin intervención en curso", () => {
    const alto = reporte.secciones[0].indicadores!.find((i) => i.etiqueta === "Riesgo alto")!;
    expect(alto.valor).toBe("2");
    expect(alto.detalle).toBe("1 sin intervención en curso");
  });

  it("incluye el aviso de habeas data", () => {
    expect(reporte.avisoPrivacidad).toMatch(/Ley 1581 de 2012/);
  });
});

describe("contenidoIntervenciones", () => {
  const grupo = (n: number, p: number) => ({ n, permanecieron: p, tasa: (100 * p) / n });
  const efectividad = {
    observaciones: 1200,
    modeloVersion: "sklearn-20261009",
    desde: "2021-1",
    general: {
      tratados: grupo(200, 160),
      controles: grupo(1000, 900),
      diferenciaIngenua: -10,
      efectoAjustado: 4.5,
      ic95: [1.2, 7.8],
      significativo: true,
      tratadosComparables: 190,
      estratos: [{ franja: "≥ 45 %", tratados: grupo(50, 30), controles: grupo(80, 40), diferencia: 10 }],
    },
    porTipo: [
      { tipo: "TUTORIA", tratados: grupo(80, 66), controles: grupo(1000, 900), diferenciaIngenua: -7.5, efectoAjustado: 6.1, ic95: [2, 10], significativo: true, tratadosComparables: 80, estratos: [] },
      { tipo: "ACOMPANAMIENTO_PSICOLOGICO", tratados: grupo(40, 30), controles: grupo(1000, 900), diferenciaIngenua: -15, efectoAjustado: -3.4, ic95: [-12, 5], significativo: false, tratadosComparables: 40, estratos: [] },
    ],
    cobertura: [{ periodo: "2025-2", enRiesgo: 100, intervenidos: 30, cobertura: 30 }],
    interpretacion: ["Texto de interpretación."],
  } as unknown as EfectividadIntervenciones;

  const r = contenidoIntervenciones(efectividad, ctx);

  it("muestra el efecto ajustado con su intervalo y significancia", () => {
    const ind = r.secciones[0].indicadores!.find((i) => i.etiqueta === "Efecto ajustado por riesgo")!;
    expect(ind.valor).toBe("+4,5 pp");
    expect(ind.detalle).toContain("IC 95 %: +1,2 pp a +7,8 pp");
    expect(ind.detalle).toContain("significativo");
  });

  it("conserva el signo de los efectos negativos en el gráfico por tipo", () => {
    const barras = r.secciones[2].barras!;
    expect(barras.formato).toBe("decimal");
    expect(barras.datos.find((d) => d.etiqueta === "Acompañamiento psicológico")!.valor).toBe(-3.4);
  });
});

describe("contenidoImpactoInstitucional", () => {
  const impacto = {
    desertores: 512,
    semestresNoCursados: 3000,
    semestresCursadosSinTitulo: 1400,
    ingresosNoPercibidos: 20_000_000_000,
    perdidaRegionalTotal: 49_000_000_000,
    porPrograma: [{ clave: "Medicina", desertores: 40, semestresNoCursados: 300, ingresosNoPercibidos: 5_000_000_000 }],
    porAnioRetiro: [{ clave: "2024", desertores: 60, semestresNoCursados: 400, ingresosNoPercibidos: 2_000_000_000 }],
    graduacion: [{ cohorte: 2018, estudiantes: 180, graduados: 100, desertores: 70, rezagados: 10, tasaGraduacion: 55.6, tasaDesercion: 38.9 }],
    regional: [{ municipio: "Pasto", departamento: "Nariño", desertores: 230, perdidaIngresoVida: 20_000_000_000 }],
    departamentos: [],
    lineaBase: { desertoresAnuales: 50, ingresosPerdidosAnuales: 2_000_000_000, perdidaRegionalAnual: 4_000_000_000, tasaDesercionAnual: 7.7, tasaGraduacion: 58.8, tasaDesercionCohorte: 38, tasaRezago: 3.2 },
    filtros: {},
    programas: [],
    periodoActual: "2026-2",
    periodosBase: ["2025-2", "2026-1"],
    horizonteAnios: 20,
  } as unknown as ImpactoInstitucional;

  it("incluye la proyección con reducciones del 10, 20 y 30 %", () => {
    const r = contenidoImpactoInstitucional(impacto, ctx);
    const proyeccion = r.secciones.find((s) => s.titulo.startsWith("Proyección"))!.tabla!;
    expect(proyeccion.filas.map((f) => f[0])).toEqual([10, 20, 30]);
    // Retener más estudiantes nunca recupera menos matrícula
    const recuperado = proyeccion.filas.map((f) => f[2] as number);
    expect(recuperado[0]).toBeLessThan(recuperado[1]);
    expect(recuperado[1]).toBeLessThan(recuperado[2]);
  });
});
