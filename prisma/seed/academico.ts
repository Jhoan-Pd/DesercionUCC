/**
 * Datos académicos del periodo en curso para la Fase 2 (panel docente):
 * cursos por programa y semestre, docentes asignados e inscripciones con nota parcial y asistencia.
 * Función pura y determinista (misma semilla => mismos cursos).
 */
import { randomUUID } from "node:crypto";
import { Aleatorio, acotar } from "./aleatorio";
import type { DatasetSintetico } from "./generador";

export interface DocenteSeed {
  id: string;
  /** El docente demo recibe los cursos de primeros semestres de tres programas (los más poblados) */
  demo: boolean;
}

export interface CursoSeed {
  id: string;
  codigo: string;
  nombre: string;
  semestre: number;
  creditos: number;
  programaId: string;
  periodoId: string;
  docenteId: string;
}

export interface InscripcionSeed {
  id: string;
  cursoId: string;
  estudianteId: string;
  notaParcial: number | null;
  asistenciaPct: number;
  fallas: number;
}

const PREFIJOS: Record<string, string> = {
  "Ingeniería de Sistemas": "SIS",
  Derecho: "DER",
  Psicología: "PSI",
  "Contaduría Pública": "CON",
  "Administración de Empresas": "ADM",
  Odontología: "ODO",
  Medicina: "MED",
  Enfermería: "ENF",
  "Ingeniería Civil": "CIV",
};

/** Asignatura núcleo de cada semestre (índice 0 = semestre 1) */
const NUCLEO: Record<string, string[]> = {
  "Ingeniería de Sistemas": ["Introducción a la programación", "Programación orientada a objetos", "Estructuras de datos", "Bases de datos", "Programación web", "Ingeniería de software", "Redes de computadores", "Sistemas operativos", "Inteligencia artificial", "Trabajo de grado"],
  Derecho: ["Introducción al derecho", "Derecho romano", "Derecho constitucional", "Derecho civil: bienes", "Derecho penal general", "Derecho laboral", "Derecho administrativo", "Derecho procesal", "Consultorio jurídico I", "Consultorio jurídico II"],
  Psicología: ["Fundamentos de psicología", "Procesos psicológicos básicos", "Psicología del desarrollo", "Psicometría", "Psicopatología", "Psicología social", "Psicología clínica", "Psicología organizacional", "Práctica profesional I", "Práctica profesional II"],
  "Contaduría Pública": ["Fundamentos de contabilidad", "Contabilidad intermedia", "Costos", "Tributaria", "Finanzas", "Auditoría", "Revisoría fiscal", "Normas internacionales (NIIF)", "Práctica contable"],
  "Administración de Empresas": ["Fundamentos de administración", "Microeconomía", "Mercadeo", "Gestión del talento humano", "Finanzas corporativas", "Producción y operaciones", "Gerencia estratégica", "Emprendimiento", "Práctica empresarial"],
  Odontología: ["Morfología dental", "Bioquímica", "Histología", "Microbiología", "Operatoria dental", "Periodoncia", "Endodoncia", "Prostodoncia", "Odontopediatría", "Clínica integral"],
  Medicina: ["Biología celular", "Anatomía", "Fisiología", "Bioquímica médica", "Farmacología", "Patología", "Semiología", "Medicina interna", "Pediatría", "Cirugía", "Ginecología y obstetricia", "Internado"],
  Enfermería: ["Fundamentos de enfermería", "Anatomía y fisiología", "Farmacología", "Enfermería del adulto", "Salud materno-perinatal", "Enfermería pediátrica", "Salud mental", "Salud pública", "Práctica integral"],
  "Ingeniería Civil": ["Cálculo diferencial", "Física mecánica", "Estática", "Resistencia de materiales", "Mecánica de suelos", "Hidráulica", "Análisis estructural", "Vías y transporte", "Construcción", "Trabajo de grado"],
};

const TRANSVERSAL_A = ["Cátedra de economía solidaria", "Inglés I", "Inglés II", "Inglés III", "Inglés IV", "Ética profesional", "Investigación I", "Investigación II", "Electiva I", "Electiva II", "Electiva III", "Electiva IV"];
const TRANSVERSAL_B = ["Lectura y escritura académica", "Constitución política", "Estadística", "Emprendimiento solidario", "Metodología de la investigación", "Responsabilidad social", "Opción de grado I", "Opción de grado II", "Seminario I", "Seminario II", "Seminario III", "Seminario IV"];

const PROGRAMAS_DEMO = ["Ingeniería de Sistemas", "Derecho", "Psicología"];
const SESIONES_SEMESTRE = 32;

export function generarCursos(d: DatasetSintetico, docentes: DocenteSeed[], semilla = 2027): { cursos: CursoSeed[]; inscripciones: InscripcionSeed[] } {
  const r = new Aleatorio(semilla);
  const periodo = d.periodos.find((p) => p.activo);
  if (!periodo) return { cursos: [], inscripciones: [] };
  const demo = docentes.find((x) => x.demo);
  const otros = docentes.filter((x) => !x.demo);

  // Nota del periodo en curso por estudiante (notas parciales del semestre)
  const notaActual = new Map(d.notas.filter((n) => n.periodoId === periodo.id).map((n) => [n.estudianteId, n]));
  const activos = d.estudiantes.filter((e) => e.estado === "ACTIVO" && notaActual.has(e.id));

  const cursos: CursoSeed[] = [];
  const inscripciones: InscripcionSeed[] = [];
  let turno = 0;

  for (const programa of d.programas) {
    const prefijo = PREFIJOS[programa.nombre] ?? programa.nombre.slice(0, 3).toUpperCase();
    const nucleo = NUCLEO[programa.nombre] ?? [];
    for (let semestre = 1; semestre <= programa.duracionSemestres; semestre++) {
      const grupo = activos.filter((e) => e.programaId === programa.id && e.semestreActual === semestre);
      if (grupo.length === 0) continue;
      const nombres = [
        nucleo[semestre - 1] ?? `Profundización ${semestre}`,
        TRANSVERSAL_A[(semestre - 1) % TRANSVERSAL_A.length],
        TRANSVERSAL_B[(semestre - 1) % TRANSVERSAL_B.length],
      ];
      nombres.forEach((nombre, j) => {
        const esDemo = demo && PROGRAMAS_DEMO.includes(programa.nombre) && semestre <= 3 && j <= 1;
        const docente = esDemo ? demo : otros[turno++ % Math.max(1, otros.length)] ?? demo;
        if (!docente) return;
        const curso: CursoSeed = {
          id: randomUUID(),
          codigo: `${prefijo}-${semestre}0${j + 1}`,
          nombre,
          semestre,
          creditos: j === 0 ? 4 : r.elegir([2, 3]),
          programaId: programa.id,
          periodoId: periodo.id,
          docenteId: docente.id,
        };
        cursos.push(curso);
        for (const e of grupo) {
          const n = notaActual.get(e.id)!;
          const asistencia = Math.round(acotar(n.asistenciaPct + r.normal(0, 4), 30, 100) * 10) / 10;
          inscripciones.push({
            id: randomUUID(),
            cursoId: curso.id,
            estudianteId: e.id,
            // 5 % aún sin calificaciones en el corte
            notaParcial: r.bernoulli(0.05) ? null : Math.round(acotar(n.promedio + r.normal(0, 0.35), 0, 5) * 10) / 10,
            asistenciaPct: asistencia,
            fallas: Math.round(((100 - asistencia) / 100) * SESIONES_SEMESTRE * 0.6),
          });
        }
      });
    }
  }
  return { cursos, inscripciones };
}
