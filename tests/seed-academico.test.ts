import { describe, expect, it } from "vitest";
import { generarDataset } from "../prisma/seed/generador";
import { generarCursos } from "../prisma/seed/academico";

describe("generarCursos (periodo en curso)", () => {
  const d = generarDataset({ totalEstudiantes: 1500, semilla: 2026 });
  const docentes = [{ id: "demo", demo: true }, ...Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, demo: false }))];
  const { cursos, inscripciones } = generarCursos(d, docentes);
  const periodoActual = d.periodos.find((p) => p.activo)!;

  it("todos los cursos son del periodo activo y su código es único", () => {
    expect(cursos.every((c) => c.periodoId === periodoActual.id)).toBe(true);
    expect(new Set(cursos.map((c) => c.codigo)).size).toBe(cursos.length);
  });

  it("cada inscripción es de un estudiante ACTIVO del mismo programa y semestre del curso", () => {
    const est = new Map(d.estudiantes.map((e) => [e.id, e]));
    const curso = new Map(cursos.map((c) => [c.id, c]));
    for (const i of inscripciones) {
      const e = est.get(i.estudianteId)!;
      const c = curso.get(i.cursoId)!;
      expect(e.estado).toBe("ACTIVO");
      expect(e.programaId).toBe(c.programaId);
      expect(e.semestreActual).toBe(c.semestre);
    }
  });

  it("cada estudiante activo queda inscrito en 3 cursos", () => {
    const porEst = new Map<string, number>();
    for (const i of inscripciones) porEst.set(i.estudianteId, (porEst.get(i.estudianteId) ?? 0) + 1);
    expect([...porEst.values()].every((n) => n === 3)).toBe(true);
  });

  it("el docente demo tiene cursos de primeros semestres con estudiantes", () => {
    const demo = cursos.filter((c) => c.docenteId === "demo");
    expect(demo.length).toBeGreaterThan(3);
    expect(demo.every((c) => c.semestre <= 3)).toBe(true);
    expect(inscripciones.filter((i) => demo.some((c) => c.id === i.cursoId)).length).toBeGreaterThan(30);
  });

  it("notas parciales y asistencia en rango", () => {
    expect(inscripciones.every((i) => (i.notaParcial === null || (i.notaParcial >= 0 && i.notaParcial <= 5)) && i.asistenciaPct >= 0 && i.asistenciaPct <= 100 && i.fallas >= 0)).toBe(true);
  });
});
