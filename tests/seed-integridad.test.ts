import { describe, expect, it } from "vitest";
import { generarDataset } from "../prisma/seed/generador";

/**
 * Verifica la integridad del dataset sintético SIN necesitar base de datos:
 * llaves foráneas, unicidad y coherencia entre estado y retiro.
 */
describe("generarDataset", () => {
  const d = generarDataset({ totalEstudiantes: 1500, semilla: 2026 });

  it("genera exactamente 1.500 estudiantes de cohortes 2018-2025", () => {
    expect(d.estudiantes).toHaveLength(1500);
    const anios = new Set(d.estudiantes.map((e) => e.cohorteAnio));
    expect([...anios].sort()).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it("es determinista: misma semilla, mismos resultados", () => {
    const otro = generarDataset({ totalEstudiantes: 300, semilla: 7 });
    const otro2 = generarDataset({ totalEstudiantes: 300, semilla: 7 });
    expect(otro.estudiantes.map((e) => `${e.programaId === otro2.estudiantes[0].programaId}`).length).toBe(300);
    expect(otro.estudiantes.map((e) => [e.estrato, e.estado, e.semestreActual])).toEqual(otro2.estudiantes.map((e) => [e.estrato, e.estado, e.semestreActual]));
  });

  it("todas las llaves foráneas apuntan a registros existentes", () => {
    const prog = new Set(d.programas.map((p) => p.id));
    const per = new Set(d.periodos.map((p) => p.id));
    const est = new Set(d.estudiantes.map((e) => e.id));
    const cau = new Set(d.causas.map((c) => c.id));
    expect(d.estudiantes.every((e) => prog.has(e.programaId) && per.has(e.periodoIngresoId))).toBe(true);
    expect(d.matriculas.every((m) => est.has(m.estudianteId) && per.has(m.periodoId))).toBe(true);
    expect(d.notas.every((n) => est.has(n.estudianteId) && per.has(n.periodoId))).toBe(true);
    expect(d.financiaciones.every((f) => est.has(f.estudianteId))).toBe(true);
    expect(d.retiros.every((r) => est.has(r.estudianteId) && per.has(r.periodoId) && cau.has(r.causaId))).toBe(true);
    expect(d.parametros.filter((p) => p.programaId).every((p) => prog.has(p.programaId!))).toBe(true);
  });

  it("los identificadores únicos no se repiten (código, hash anónimo, ids)", () => {
    expect(new Set(d.estudiantes.map((e) => e.codigo)).size).toBe(1500);
    expect(new Set(d.estudiantes.map((e) => e.hashAnonimo)).size).toBe(1500);
    expect(new Set(d.estudiantes.map((e) => e.id)).size).toBe(1500);
  });

  it("(estudiante, periodo) es único en matrículas y notas", () => {
    const claveM = new Set(d.matriculas.map((m) => `${m.estudianteId}|${m.periodoId}`));
    const claveN = new Set(d.notas.map((n) => `${n.estudianteId}|${n.periodoId}`));
    expect(claveM.size).toBe(d.matriculas.length);
    expect(claveN.size).toBe(d.notas.length);
  });

  it("cada desertor tiene exactamente un retiro y solo ellos", () => {
    const desertores = d.estudiantes.filter((e) => e.estado === "DESERTOR");
    expect(d.retiros).toHaveLength(desertores.length);
    expect(new Set(d.retiros.map((r) => r.estudianteId)).size).toBe(desertores.length);
    const idsDesertores = new Set(desertores.map((e) => e.id));
    expect(d.retiros.every((r) => idsDesertores.has(r.estudianteId))).toBe(true);
  });

  it("el semestre de retiro coincide con el último semestre cursado", () => {
    const porId = new Map(d.estudiantes.map((e) => [e.id, e]));
    for (const r of d.retiros) expect(r.semestreRetiro).toBe(porId.get(r.estudianteId)!.semestreActual);
  });

  it("ningún estudiante gradúa antes de completar los semestres del programa", () => {
    const dur = new Map(d.programas.map((p) => [p.id, p.duracionSemestres]));
    for (const e of d.estudiantes.filter((x) => x.estado === "GRADUADO")) expect(e.semestreActual).toBeGreaterThanOrEqual(dur.get(e.programaId)!);
  });

  it("la deserción acumulada a 10 semestres de las cohortes 2018-2021 es realista (30%-50%)", () => {
    const retPor = new Map(d.retiros.map((r) => [r.estudianteId, r]));
    const grupo = d.estudiantes.filter((e) => e.cohorteAnio <= 2021);
    const des = grupo.filter((e) => (retPor.get(e.id)?.semestreRetiro ?? 99) <= 10).length;
    const tasa = (des / grupo.length) * 100;
    expect(tasa).toBeGreaterThan(30);
    expect(tasa).toBeLessThan(50);
  });

  it("estratos, notas y asistencia están dentro de rangos válidos", () => {
    expect(d.estudiantes.every((e) => e.estrato >= 1 && e.estrato <= 6)).toBe(true);
    expect(d.notas.every((n) => n.promedio >= 0 && n.promedio <= 5 && n.asistenciaPct >= 0 && n.asistenciaPct <= 100)).toBe(true);
    expect(d.notas.every((n) => n.materiasPerdidas <= n.materiasInscritas)).toBe(true);
  });

  it("incluye parámetros globales y salario de enganche por cada programa", () => {
    expect(d.parametros.filter((p) => p.clave === "salario_profesional_mensual" && p.programaId)).toHaveLength(d.programas.length);
    expect(d.parametros.some((p) => p.clave === "spadies_cohorte_sem10")).toBe(true);
  });

  it("solo hay un periodo activo (2026-2)", () => {
    const activos = d.periodos.filter((p) => p.activo);
    expect(activos).toHaveLength(1);
    expect(activos[0].codigo).toBe("2026-2");
  });

  it("las intervenciones históricas son coherentes: desde 2021, en periodos cerrados y con matrícula ese periodo", () => {
    expect(d.intervenciones.length).toBeGreaterThan(200);
    const periodo = new Map(d.periodos.map((p) => [p.id, p]));
    const matriculado = new Set(d.matriculas.map((m) => `${m.estudianteId}|${m.periodoId}`));
    for (const i of d.intervenciones) {
      const p = periodo.get(i.periodoId)!;
      expect(p.anio).toBeGreaterThanOrEqual(2021);
      expect(p.activo).toBe(false);
      expect(matriculado.has(`${i.estudianteId}|${i.periodoId}`)).toBe(true);
      expect(i.fecha.getTime()).toBeGreaterThanOrEqual(p.fechaInicio.getTime());
      expect(i.fecha.getTime()).toBeLessThanOrEqual(p.fechaFin.getTime());
      expect(i.montoApoyo === null).toBe(i.tipo !== "APOYO_ECONOMICO");
    }
  });

  it("hay intervenciones de los cuatro tipos para poder compararlos", () => {
    const tipos = new Set(d.intervenciones.map((i) => i.tipo));
    expect([...tipos].sort()).toEqual(["ACOMPANAMIENTO_PSICOLOGICO", "APOYO_ECONOMICO", "ORIENTACION_VOCACIONAL", "TUTORIA"]);
  });
});
