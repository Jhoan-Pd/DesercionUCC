import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { Rol } from "@/lib/roles";
import { ServicioParametros } from "@/services/parametros/ServicioParametros";
import { CalculadoraImpacto } from "./CalculadoraImpacto";
import type { EntradaImpacto, ResultadoImpacto, TipoFinanciacion } from "./tipos";

export interface ProgramaOpcion {
  id: string;
  nombre: string;
  duracionSemestres: number;
  valorSemestre: number;
}

export interface PerfilImpacto {
  programas: ProgramaOpcion[];
  programaId: string;
  entrada: EntradaImpacto;
  /** Valores de referencia para proponer tasa y plazo al elegir un crédito */
  referenciasCredito: { tasaIcetexPct: number; tasaCreditoUccPct: number; plazoMeses: number };
  /** Solo cuando los datos provienen de un estudiante real (consulta individual autorizada) */
  estudiante: { codigo: string; nombre: string; estado: string; semestreActual: number } | null;
}

/** Orquesta la calculadora: carga parámetros y perfiles desde la BD */
export class ServicioImpacto {
  private readonly parametros = new ServicioParametros();

  async listarProgramas(): Promise<ProgramaOpcion[]> {
    return prisma.programa.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, duracionSemestres: true, valorSemestre: true },
      orderBy: { nombre: "asc" },
    });
  }

  /** Valores por defecto para un programa (cuando no hay estudiante asociado) */
  async perfilPorPrograma(programaId?: string): Promise<PerfilImpacto> {
    const programas = await this.listarProgramas();
    const programa = programas.find((p) => p.id === programaId) ?? programas[0];
    if (!programa) throw new ErrorApi(404, "No hay programas configurados.");
    const { mapa } = await this.parametros.paraCalculadora(programa.id);
    return {
      programas,
      programaId: programa.id,
      referenciasCredito: this.referenciasCredito(mapa),
      estudiante: null,
      entrada: this.entradaBase(programa, mapa, 4, { tipo: "ICETEX", porcentajeFinanciado: 80 }, 0),
    };
  }

  /**
   * Perfil a partir de un estudiante real. Solo el propio estudiante o roles autorizados
   * (ADMIN/BIENESTAR) pueden consultar datos individuales (Ley 1581 de 2012).
   */
  async perfilPorEstudiante(opts: { estudianteId?: string; codigo?: string }, solicitante: { rol: Rol; estudianteId: string | null; usuarioId: string }): Promise<PerfilImpacto> {
    const est = await prisma.estudiante.findFirst({
      where: opts.estudianteId ? { id: opts.estudianteId } : { codigo: opts.codigo },
      include: { programa: true, financiaciones: true, matriculas: { select: { semestre: true, valorMatricula: true } } },
    });
    if (!est) throw new ErrorApi(404, "No se encontró el estudiante.");

    const esPropio = solicitante.estudianteId === est.id;
    const autorizado = solicitante.rol === "ADMIN" || solicitante.rol === "BIENESTAR" || esPropio;
    if (!autorizado) throw new ErrorApi(403, "No tienes permiso para consultar datos individuales de otro estudiante.");
    if (!esPropio) {
      // Rastro de auditoría mínimo del acceso a datos personales (habeas data)
      console.info(`[AUDITORIA] usuario=${solicitante.usuarioId} rol=${solicitante.rol} consulta estudiante=${est.hashAnonimo}`);
    }

    const programas = await this.listarProgramas();
    const { mapa } = await this.parametros.paraCalculadora(est.programaId);
    const fin = est.financiaciones.find((f) => f.tipo === "ICETEX" || f.tipo === "CREDITO_UCC") ?? est.financiaciones[0];
    // El semestre en curso ya está pagado (matrícula y deuda): cuenta como invertido. Así la matrícula,
    // la deuda y los semestres restantes son coherentes entre sí.
    const semestresCursados = est.semestreActual;
    const matriculaPagada = est.matriculas.filter((m) => m.semestre <= semestresCursados).reduce((s, m) => s + m.valorMatricula, 0);

    const entrada = this.entradaBase(
      { id: est.programa.id, nombre: est.programa.nombre, duracionSemestres: est.programa.duracionSemestres, valorSemestre: est.programa.valorSemestre },
      mapa,
      Math.min(semestresCursados, est.programa.duracionSemestres),
      fin
        ? { tipo: fin.tipo as TipoFinanciacion, porcentajeFinanciado: fin.porcentajeCubierto, saldoDeuda: fin.saldoPendiente > 0 ? fin.saldoPendiente : undefined, tasaEA: fin.tasaEA, plazoMeses: fin.plazoMeses }
        : { tipo: "RECURSOS_PROPIOS", porcentajeFinanciado: 100 },
      est.trabaja ? this.ingresoEstimadoPorHoras(est.horasTrabajoSemana, mapa) : 0,
    );
    if (matriculaPagada > 0) entrada.matriculaTotalPagada = matriculaPagada;

    return {
      programas,
      programaId: est.programaId,
      referenciasCredito: this.referenciasCredito(mapa),
      entrada,
      estudiante: { codigo: est.codigo, nombre: `${est.nombres} ${est.apellidos}`, estado: est.estado, semestreActual: est.semestreActual },
    };
  }

  /** Ejecuta la calculadora con los parámetros vigentes en la BD */
  async calcular(entrada: EntradaImpacto, programaId?: string): Promise<ResultadoImpacto> {
    const { parametros } = await this.parametros.paraCalculadora(programaId);
    try {
      return new CalculadoraImpacto(parametros).calcular(entrada);
    } catch (e) {
      throw new ErrorApi(400, e instanceof Error ? e.message : "No fue posible calcular el impacto.");
    }
  }

  // ---------------------------------------------------------------
  private referenciasCredito(mapa: Record<string, number>): PerfilImpacto["referenciasCredito"] {
    return {
      tasaIcetexPct: mapa["tasa_icetex_ea"] ?? 11,
      tasaCreditoUccPct: mapa["tasa_credito_ucc_ea"] ?? 14,
      plazoMeses: mapa["plazo_amortizacion_meses"] ?? 60,
    };
  }

  private ingresoEstimadoPorHoras(horasSemana: number, mapa: Record<string, number>): number {
    const smmlv = mapa["smmlv"] ?? 1_750_905;
    return Math.round((smmlv * Math.min(horasSemana, 48)) / 48 / 1000) * 1000;
  }

  private entradaBase(
    programa: ProgramaOpcion,
    mapa: Record<string, number>,
    semestresCursados: number,
    fin: { tipo: TipoFinanciacion; porcentajeFinanciado: number; saldoDeuda?: number; tasaEA?: number; plazoMeses?: number },
    ingresoActual: number,
  ): EntradaImpacto {
    const esCredito = fin.tipo === "ICETEX" || fin.tipo === "CREDITO_UCC";
    const tasaPorDefecto = fin.tipo === "ICETEX" ? (mapa["tasa_icetex_ea"] ?? 11) / 100 : fin.tipo === "CREDITO_UCC" ? (mapa["tasa_credito_ucc_ea"] ?? 14) / 100 : 0;
    return {
      programa: { nombre: programa.nombre, duracionSemestres: programa.duracionSemestres, valorSemestre: programa.valorSemestre },
      semestresCursados,
      transporteMensual: mapa["transporte_mensual"] ?? 120_000,
      materialesSemestre: mapa["materiales_semestre"] ?? 350_000,
      sostenimientoMensual: mapa["sostenimiento_mensual"] ?? 650_000,
      financiacion: {
        tipo: fin.tipo,
        porcentajeFinanciado: fin.porcentajeFinanciado,
        saldoDeuda: fin.saldoDeuda,
        tasaEA: fin.tasaEA && fin.tasaEA > 0 ? fin.tasaEA : tasaPorDefecto,
        plazoMeses: fin.plazoMeses && fin.plazoMeses > 0 ? fin.plazoMeses : esCredito ? (mapa["plazo_amortizacion_meses"] ?? 60) : 0,
      },
      salarioProfesionalMensual: mapa["salario_profesional_mensual"] ?? 2_900_000,
      nivelAlternativo: "BACHILLER",
      ingresoMensualActual: ingresoActual,
    };
  }
}
