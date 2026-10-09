import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FiltrosDashboard } from "@/lib/validators/dashboard";
import { ServicioParametros } from "@/services/parametros/ServicioParametros";
import {
  calcularKpis,
  curvasSupervivencia,
  desercionPorCohorte,
  desercionPorMunicipio,
  desercionPorPeriodo,
  desercionPorPrograma,
  desercionPorSemestre,
  resumenCausas,
  type EstudianteFila,
  type FilaCohorte,
  type FilaMunicipio,
  type FilaPeriodo,
  type FilaPrograma,
  type FilaSemestre,
  type Kpis,
  type ResultadoSupervivencia,
  type ResumenCausas,
  type RetiroFila,
} from "./calculos";
import type { ReferenciasSpadies } from "@/services/parametros/conversores";

export interface OpcionesFiltros {
  programas: { id: string; nombre: string }[];
  cohortes: number[];
  estratos: number[];
}

export interface ResumenDashboard {
  filtros: FiltrosDashboard;
  opciones: OpcionesFiltros;
  kpis: Kpis;
  porCohorte: FilaCohorte[];
  porPrograma: FilaPrograma[];
  porSemestre: FilaSemestre[];
  porPeriodo: FilaPeriodo[];
  supervivencia: ResultadoSupervivencia;
  causas: ResumenCausas;
  porMunicipio: FilaMunicipio[];
  referencias: ReferenciasSpadies;
  periodoActual: string | null;
  generadoEn: string;
}

/**
 * Servicio del dashboard institucional.
 * Carga las filas mínimas necesarias (≈1.500 estudiantes) y delega las estadísticas
 * en funciones puras (calculos.ts). Con este volumen, agregar en memoria es más simple y
 * flexible que escribir SQL por cada gráfica, y permite combinar filtros libremente.
 * Si el dataset real creciera a cientos de miles de filas, se movería a vistas SQL/materializadas.
 */
export class ServicioDashboard {
  private readonly parametros = new ServicioParametros();

  /** Traduce los filtros combinables a un WHERE de Prisma */
  static construirWhere(f: FiltrosDashboard): Prisma.EstudianteWhereInput {
    const where: Prisma.EstudianteWhereInput = {};
    if (f.programaId) where.programaId = f.programaId;
    if (f.cohorteAnio) where.cohorteAnio = f.cohorteAnio;
    if (f.estrato) where.estrato = f.estrato;
    if (f.sexo) where.sexo = f.sexo;
    if (f.trabaja !== undefined) where.trabaja = f.trabaja;
    if (f.financiacion) where.financiaciones = { some: { tipo: f.financiacion } };
    return where;
  }

  async obtenerResumen(filtros: FiltrosDashboard): Promise<ResumenDashboard> {
    const where = ServicioDashboard.construirWhere(filtros);

    const [periodos, estudiantesDb, retirosDb, matPorSemestre, matPorPeriodo, programas, cohortes, spadies] = await Promise.all([
      prisma.periodo.findMany({ select: { id: true, codigo: true, indice: true, activo: true }, orderBy: { indice: "asc" } }),
      prisma.estudiante.findMany({
        where,
        select: {
          id: true,
          programaId: true,
          cohorte: true,
          cohorteAnio: true,
          estado: true,
          semestreActual: true,
          municipioOrigen: true,
          periodoIngreso: { select: { indice: true } },
        },
      }),
      prisma.retiro.findMany({
        where: { estudiante: where },
        select: {
          estudianteId: true,
          periodoId: true,
          semestreRetiro: true,
          causa: { select: { nombre: true, categoria: true } },
        },
      }),
      prisma.matricula.groupBy({
        by: ["semestre"],
        where: { estudiante: where, periodo: { activo: false } },
        _count: { _all: true },
      }),
      prisma.matricula.groupBy({
        by: ["periodoId"],
        where: { estudiante: where, periodo: { activo: false } },
        _count: { _all: true },
      }),
      prisma.programa.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
      prisma.estudiante.findMany({ distinct: ["cohorteAnio"], select: { cohorteAnio: true }, orderBy: { cohorteAnio: "asc" } }),
      this.parametros.referenciasSpadies(),
    ]);

    const periodoActual = periodos.find((p) => p.activo) ?? periodos[periodos.length - 1];
    const indiceActual = periodoActual ? periodoActual.indice : 0;
    const cerrados = periodos.filter((p) => !p.activo);

    const estudiantes: EstudianteFila[] = estudiantesDb.map((e) => ({
      id: e.id,
      programaId: e.programaId,
      cohorte: e.cohorte,
      cohorteAnio: e.cohorteAnio,
      indiceIngreso: e.periodoIngreso.indice,
      estado: e.estado,
      semestreActual: e.semestreActual,
      municipioOrigen: e.municipioOrigen,
    }));
    const retiros: RetiroFila[] = retirosDb.map((r) => ({
      estudianteId: r.estudianteId,
      periodoId: r.periodoId,
      semestreRetiro: r.semestreRetiro,
      causaNombre: r.causa.nombre,
      categoria: r.causa.categoria,
    }));

    const nombresProgramas = new Map(programas.map((p) => [p.id, p.nombre]));
    const porPeriodo = desercionPorPeriodo(
      cerrados,
      matPorPeriodo.map((m) => ({ clave: m.periodoId, total: m._count._all })),
      retiros,
    );

    return {
      filtros,
      opciones: {
        programas,
        cohortes: cohortes.map((c) => c.cohorteAnio),
        estratos: [1, 2, 3, 4, 5, 6],
      },
      kpis: calcularKpis(estudiantes, porPeriodo, spadies),
      porCohorte: desercionPorCohorte(estudiantes, indiceActual, spadies),
      porPrograma: desercionPorPrograma(estudiantes, nombresProgramas),
      porSemestre: desercionPorSemestre(
        matPorSemestre.map((m) => ({ clave: m.semestre, total: m._count._all })),
        retiros,
      ),
      porPeriodo,
      supervivencia: curvasSupervivencia(estudiantes, retiros, spadies),
      causas: resumenCausas(retiros, spadies),
      porMunicipio: desercionPorMunicipio(estudiantes),
      referencias: spadies,
      periodoActual: periodoActual?.codigo ?? null,
      generadoEn: new Date().toISOString(),
    };
  }
}
