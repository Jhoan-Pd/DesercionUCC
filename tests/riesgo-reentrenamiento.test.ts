import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generarDataset } from "../prisma/seed/generador";
import { Reentrenador, type MetricasReentrenamiento } from "@/services/riesgo/Reentrenador";
import { ModeloRiesgo, type DefinicionModelo } from "@/services/riesgo/ModeloRiesgo";
import { financiacionPrincipal, type RegistroEstudiante, type TipoFinanciacionRiesgo } from "@/services/riesgo/caracteristicas";

/** Convierte el dataset sintético del seed en los registros que lee el modelo (igual que registros.ts desde la BD) */
function registrosDesdeSeed(totalEstudiantes: number, semilla: number): RegistroEstudiante[] {
  const d = generarDataset({ totalEstudiantes, semilla });
  const programa = new Map(d.programas.map((p) => [p.id, p.nombre]));
  const periodoCerrado = new Map(d.periodos.map((p) => [p.id, !p.activo]));
  const retiro = new Map(d.retiros.map((r) => [r.estudianteId, r.semestreRetiro]));
  const fin = new Map<string, TipoFinanciacionRiesgo[]>();
  for (const f of d.financiaciones) fin.set(f.estudianteId, [...(fin.get(f.estudianteId) ?? []), f.tipo as TipoFinanciacionRiesgo]);
  const notas = new Map<string, RegistroEstudiante["notas"]>();
  for (const n of d.notas) {
    notas.set(n.estudianteId, [
      ...(notas.get(n.estudianteId) ?? []),
      { semestre: n.semestre, promedio: n.promedio, materiasPerdidas: n.materiasPerdidas, asistenciaPct: n.asistenciaPct, periodoCerrado: periodoCerrado.get(n.periodoId)! },
    ]);
  }
  return d.estudiantes.map((e) => ({
    id: e.id,
    programa: programa.get(e.programaId)!,
    estrato: e.estrato,
    edadIngreso: e.edadIngreso,
    trabaja: e.trabaja,
    horasTrabajoSemana: e.horasTrabajoSemana,
    financiacion: financiacionPrincipal(fin.get(e.id) ?? ["RECURSOS_PROPIOS"]),
    estado: e.estado,
    semestreActual: e.semestreActual,
    semestreRetiro: retiro.get(e.id) ?? null,
    notas: notas.get(e.id) ?? [],
  }));
}

const exportado = JSON.parse(readFileSync(join(__dirname, "..", "ml", "modelo_riesgo.json"), "utf8")) as { definicion: DefinicionModelo };
const registros = registrosDesdeSeed(1500, 2026);
const fecha = new Date("2026-10-15T19:32:05Z");
const resultado = new Reentrenador({ version: "admin-prueba", fecha }).entrenar(registros, new ModeloRiesgo(exportado.definicion));

describe("Reentrenador (reentrenamiento desde el panel de administración)", () => {
  it("produce una definición válida y lista para producción", () => {
    const modelo = new ModeloRiesgo(resultado.definicion);
    expect(modelo.version).toBe("admin-prueba");
    expect(resultado.definicion.origen).toBe("ENTRENAMIENTO_ADMIN");
    expect(resultado.definicion.horizonteSemestres).toBe(2);
    expect(resultado.definicion.umbrales.medio).toBeLessThan(resultado.definicion.umbrales.alto);
  });

  it("usa las mismas características que el modelo exportado desde Python", () => {
    expect(resultado.definicion.caracteristicas).toEqual(exportado.definicion.caracteristicas);
  });

  it("con los mismos datos del seed reproduce los coeficientes de scikit-learn (modelo final con todos los datos)", () => {
    resultado.definicion.coeficientes.forEach((c, i) => expect(c).toBeCloseTo(exportado.definicion.coeficientes[i], 3));
    expect(resultado.definicion.intercepto).toBeCloseTo(exportado.definicion.intercepto, 3);
  });

  it("evalúa en prueba con estudiantes que NO se usaron para ajustar (separación por estudiante)", () => {
    const m = resultado.metricas;
    expect(m.n + m.nEntrenamiento).toBeGreaterThan(5000);
    expect(m.estudiantesPrueba / m.estudiantes).toBeGreaterThan(0.12);
    expect(m.estudiantesPrueba / m.estudiantes).toBeLessThan(0.28);
    expect(m.convergio).toBe(true);
  });

  it("discrimina mucho mejor que el azar y no sobreajusta de forma exagerada", () => {
    const m = resultado.metricas;
    expect(m.auc).toBeGreaterThan(0.75);
    expect(m.aucEntrenamiento - m.auc).toBeLessThan(0.05);
    expect(m.brier).toBeLessThan(m.tasaBase * (1 - m.tasaBase)); // mejor que predecir siempre la tasa base
  });

  it("compara con el modelo activo sobre las mismas filas y recomienda activar si no empeora", () => {
    expect(resultado.comparacion).not.toBeNull();
    expect(resultado.comparacion!.versionActual).toBe(exportado.definicion.version);
    expect(Math.abs(resultado.comparacion!.auc.nuevo - resultado.comparacion!.auc.actual)).toBeLessThan(0.02);
    expect(resultado.recomendacion).toBe("ACTIVAR");
  });

  it("lista las variables de mayor peso con su etiqueta legible", () => {
    expect(resultado.coeficientesPrincipales).toHaveLength(8);
    const pesos = resultado.coeficientesPrincipales.map((c) => Math.abs(c.coeficiente));
    expect([...pesos].sort((a, b) => b - a)).toEqual(pesos);
    expect(resultado.coeficientesPrincipales.every((c) => c.etiqueta.length > 0)).toBe(true);
  });

  it("guarda la fecha y la configuración del entrenamiento", () => {
    expect(resultado.metricas.entrenadoEn).toBe(fecha.toISOString());
    expect(resultado.metricas.C).toBe(1);
  });

  it("más regularización (C pequeño) encoge los coeficientes", () => {
    const fuerte = new Reentrenador({ version: "c-bajo", C: 0.001 }).entrenar(registros, null);
    const norma = (d: DefinicionModelo) => Math.hypot(...d.coeficientes);
    expect(norma(fuerte.definicion)).toBeLessThan(norma(resultado.definicion));
  });

  it("rechaza datos insuficientes y opciones inválidas", () => {
    expect(() => new Reentrenador({ version: "x" }).entrenar(registros.slice(0, 20), null)).toThrow(/pocos datos/);
    expect(() => new Reentrenador({ version: "x", C: 0 })).toThrow();
    expect(() => new Reentrenador({ version: "x", proporcionPrueba: 0.9 })).toThrow();
  });
});

describe("Reentrenador.recomendar (regla documentada)", () => {
  const base = { convergio: true, auc: 0.85 } as MetricasReentrenamiento;
  const comp = (nuevo: number, actual: number, brierNuevo = 0.08, brierActual = 0.08) => ({
    versionActual: "v1",
    auc: { nuevo, actual },
    brier: { nuevo: brierNuevo, actual: brierActual },
    sensibilidadAlto: { nuevo: 0.5, actual: 0.5 },
    precisionAlto: { nuevo: 0.4, actual: 0.4 },
  });

  it("ACTIVAR cuando el AUC se mantiene o mejora", () => {
    expect(Reentrenador.recomendar(base, comp(0.86, 0.85), 100).recomendacion).toBe("ACTIVAR");
    expect(Reentrenador.recomendar(base, comp(0.847, 0.85), 100).recomendacion).toBe("ACTIVAR");
  });

  it("REVISAR cuando baja un poco o empeora la calibración", () => {
    expect(Reentrenador.recomendar(base, comp(0.84, 0.85), 100).recomendacion).toBe("REVISAR");
    expect(Reentrenador.recomendar(base, comp(0.86, 0.85, 0.1, 0.08), 100).recomendacion).toBe("REVISAR");
  });

  it("NO_ACTIVAR cuando el AUC cae más de 0,02 o no convergió", () => {
    expect(Reentrenador.recomendar(base, comp(0.82, 0.85), 100).recomendacion).toBe("NO_ACTIVAR");
    expect(Reentrenador.recomendar({ ...base, convergio: false }, comp(0.9, 0.85), 100).recomendacion).toBe("NO_ACTIVAR");
  });

  it("REVISAR con pocos desertores en la prueba aunque las métricas se vean bien", () => {
    expect(Reentrenador.recomendar(base, comp(0.9, 0.85), 10).recomendacion).toBe("REVISAR");
  });

  it("ACTIVAR si no hay modelo activo con el que comparar", () => {
    expect(Reentrenador.recomendar(base, null, 100).recomendacion).toBe("ACTIVAR");
  });
});

describe("Reentrenador.nombreVersion", () => {
  it("usa la hora de Colombia (UTC-5)", () => {
    expect(Reentrenador.nombreVersion(new Date("2026-10-15T19:32:05Z"))).toBe("admin-20261015-143205");
    expect(Reentrenador.nombreVersion(new Date("2026-01-01T03:00:00Z"))).toBe("admin-20251231-220000");
  });
});
