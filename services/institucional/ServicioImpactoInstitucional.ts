import { prisma } from "@/lib/prisma";
import type { FiltrosInstitucional } from "@/lib/validators/institucional";
import { tasaAnualDesdeSemestrales } from "@/services/dashboard/calculos";
import { CalculadoraImpacto } from "@/services/impacto/CalculadoraImpacto";
import type { EntradaImpacto, ParametrosCalculadora } from "@/services/impacto/tipos";
import { ServicioParametros } from "@/services/parametros/ServicioParametros";
import { CalculadoraInstitucional, type DesertorInstitucional, type EstudianteCohorte, type ResumenInstitucional } from "./CalculadoraInstitucional";

export interface ImpactoInstitucional extends ResumenInstitucional {
  filtros: FiltrosInstitucional;
  programas: { id: string; nombre: string }[];
  periodoActual: string | null;
  /** Periodos que forman la línea base anual */
  periodosBase: string[];
  horizonteAnios: number;
}

/** Semestres de holgura sobre la duración del plan antes de considerar vencido el plazo de grado */
export const HOLGURA_GRADO = 2;
export const HORIZONTE_REGIONAL = 20;

/**
 * Orquesta el impacto institucional: carga datos, calcula la pérdida de ingresos de por vida de cada
 * desertor con CalculadoraImpacto (reutilizando la lógica de la Fase 1) y delega lo agregado en
 * CalculadoraInstitucional.
 */
export class ServicioImpactoInstitucional {
  private readonly parametros = new ServicioParametros();

  async obtener(filtros: FiltrosInstitucional): Promise<ImpactoInstitucional> {
    const [periodos, programas, estudiantes] = await Promise.all([
      prisma.periodo.findMany({ select: { id: true, codigo: true, indice: true, activo: true }, orderBy: { indice: "asc" } }),
      prisma.programa.findMany({ select: { id: true, nombre: true, duracionSemestres: true, valorSemestre: true }, orderBy: { nombre: "asc" } }),
      prisma.estudiante.findMany({
        where: filtros.programaId ? { programaId: filtros.programaId } : {},
        select: {
          estado: true,
          cohorteAnio: true,
          programaId: true,
          municipioOrigen: true,
          departamentoOrigen: true,
          periodoIngreso: { select: { indice: true } },
          retiro: { select: { semestreRetiro: true, periodo: { select: { anio: true, indice: true } } } },
        },
      }),
    ]);

    const actual = periodos.find((p) => p.activo) ?? periodos[periodos.length - 1];
    const indiceActual = actual?.indice ?? 0;
    const ultimos = periodos.filter((p) => !p.activo).slice(-2);
    const tasaAnual = await this.tasaAnual(ultimos.map((p) => p.id), filtros.programaId);
    const programaPorId = new Map(programas.map((p) => [p.id, p]));

    // Parámetros de la calculadora por programa (salario de enganche propio) y caché de resultados
    const parametrosPorPrograma = new Map<string, { parametros: ParametrosCalculadora; mapa: Record<string, number> }>();
    for (const p of programas) parametrosPorPrograma.set(p.id, await this.parametros.paraCalculadora(p.id));
    const cache = new Map<string, number>();
    const perdidaIngresoVida = (programaId: string, semestresCursados: number): number => {
      const clave = `${programaId}|${semestresCursados}`;
      const enCache = cache.get(clave);
      if (enCache !== undefined) return enCache;
      const prog = programaPorId.get(programaId)!;
      const { parametros, mapa } = parametrosPorPrograma.get(programaId)!;
      const entrada: EntradaImpacto = {
        programa: { nombre: prog.nombre, duracionSemestres: prog.duracionSemestres, valorSemestre: prog.valorSemestre },
        semestresCursados: Math.min(semestresCursados, prog.duracionSemestres),
        transporteMensual: mapa["transporte_mensual"] ?? 120_000,
        materialesSemestre: mapa["materiales_semestre"] ?? 350_000,
        sostenimientoMensual: mapa["sostenimiento_mensual"] ?? 650_000,
        financiacion: { tipo: "RECURSOS_PROPIOS", porcentajeFinanciado: 100, tasaEA: 0, plazoMeses: 0 },
        salarioProfesionalMensual: mapa["salario_profesional_mensual"] ?? 2_900_000,
        nivelAlternativo: "BACHILLER",
        ingresoMensualActual: 0,
      };
      const h = new CalculadoraImpacto(parametros).calcularCostoOportunidad(entrada).horizontes.find((x) => x.anios === HORIZONTE_REGIONAL);
      const valor = Math.max(0, h?.vpnDiferenciaNeta ?? 0);
      cache.set(clave, valor);
      return valor;
    };

    const desertores: DesertorInstitucional[] = [];
    const cohortes: EstudianteCohorte[] = [];
    for (const e of estudiantes) {
      const prog = programaPorId.get(e.programaId)!;
      cohortes.push({
        cohorteAnio: e.cohorteAnio,
        estado: e.estado,
        plazoVencido: e.periodoIngreso.indice + prog.duracionSemestres + HOLGURA_GRADO <= indiceActual,
      });
      if (e.estado === "DESERTOR" && e.retiro) {
        desertores.push({
          programa: prog.nombre,
          cohorteAnio: e.cohorteAnio,
          anioRetiro: e.retiro.periodo.anio,
          indiceRetiro: e.retiro.periodo.indice,
          semestreRetiro: e.retiro.semestreRetiro,
          duracionSemestres: prog.duracionSemestres,
          valorSemestre: prog.valorSemestre,
          municipio: e.municipioOrigen,
          departamento: e.departamentoOrigen,
          perdidaIngresoVida: perdidaIngresoVida(e.programaId, e.retiro.semestreRetiro),
        });
      }
    }

    const resumen = new CalculadoraInstitucional(ultimos.map((p) => p.indice), tasaAnual).calcular(desertores, cohortes);
    return {
      ...resumen,
      filtros,
      programas: programas.map((p) => ({ id: p.id, nombre: p.nombre })),
      periodoActual: actual?.codigo ?? null,
      periodosBase: ultimos.map((p) => p.codigo),
      horizonteAnios: HORIZONTE_REGIONAL,
    };
  }

  /** Tasa anual equivalente (%) a partir de los dos últimos periodos cerrados */
  private async tasaAnual(periodoIds: string[], programaId?: string): Promise<number> {
    if (periodoIds.length < 2) return 0;
    const filtroEst = programaId ? { estudiante: { programaId } } : {};
    const [mat, ret] = await Promise.all([
      prisma.matricula.groupBy({ by: ["periodoId"], where: { periodoId: { in: periodoIds }, ...filtroEst }, _count: { _all: true } }),
      prisma.retiro.groupBy({ by: ["periodoId"], where: { periodoId: { in: periodoIds }, ...filtroEst }, _count: { _all: true } }),
    ]);
    const tasa = (id: string) => {
      const m = mat.find((x) => x.periodoId === id)?._count._all ?? 0;
      const r = ret.find((x) => x.periodoId === id)?._count._all ?? 0;
      return m > 0 ? (100 * r) / m : 0;
    };
    return tasaAnualDesdeSemestrales(tasa(periodoIds[0]), tasa(periodoIds[1]));
  }
}
