import type { NivelRiesgo, Prisma } from "@prisma/client";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { FiltrosRiesgo } from "@/lib/validators/riesgo";
import { ModeloRiesgo, type Factor } from "./ModeloRiesgo";
import { cargarRegistros } from "./registros";
import { MODELO_BASE, factoresParaGuardar, motivoAlertaModelo, puntuarRegistros } from "./puntuacion";

export interface FilaPriorizada {
  estudianteId: string;
  codigo: string;
  nombre: string;
  programa: string;
  semestre: number;
  estado: string;
  puntaje: number;
  nivel: NivelRiesgo;
  principales: string[];
  alertasAbiertas: number;
  intervenciones: number;
}

export interface ListaPriorizada {
  filas: FilaPriorizada[];
  total: number;
  pagina: number;
  paginas: number;
  resumen: { ALTO: number; MEDIO: number; BAJO: number; alertasAbiertas: number };
  modelo: { version: string; origen: string; calculadoEn: string | null };
  periodo: string | null;
  programas: { id: string; nombre: string }[];
}

/**
 * Alerta temprana: aplica el modelo activo, guarda puntajes, genera alertas y arma la lista
 * priorizada para Bienestar. Solo ADMIN y BIENESTAR acceden a estos datos individuales.
 */
export class ServicioRiesgo {
  /** Modelo activo en BD; si no hay, el exportado desde Python que viene con el código */
  async modeloActivo(): Promise<ModeloRiesgo> {
    const fila = await prisma.modeloRiesgo.findFirst({ where: { activo: true }, orderBy: { creadoEn: "desc" } });
    return new ModeloRiesgo(fila ? fila.definicion : MODELO_BASE.definicion);
  }

  private async periodoActual() {
    const periodo = await prisma.periodo.findFirst({ where: { activo: true } });
    if (!periodo) throw new ErrorApi(409, "No hay un periodo académico activo. Actívalo en Admin → Periodos.");
    return periodo;
  }

  /**
   * Recalcula el puntaje de todos los estudiantes activos o aplazados en el periodo actual.
   * Crea una alerta del modelo para cada estudiante ALTO que no tenga ya una alerta abierta.
   */
  async recalcularPuntajes(): Promise<{ estudiantes: number; alto: number; medio: number; alertasNuevas: number; version: string }> {
    const [modelo, periodo] = await Promise.all([this.modeloActivo(), this.periodoActual()]);
    const registros = await cargarRegistros(prisma, { soloEstados: ["ACTIVO", "APLAZADO"] });
    const puntajes = puntuarRegistros(modelo, registros);

    const conAlerta = new Set(
      (await prisma.alerta.findMany({ where: { estado: { not: "CERRADA" } }, select: { estudianteId: true } })).map((a) => a.estudianteId),
    );
    const nuevasAlertas = puntajes.filter((p) => p.prediccion.nivel === "ALTO" && !conAlerta.has(p.estudianteId));

    await prisma.$transaction([
      prisma.puntajeRiesgo.deleteMany({ where: { periodoId: periodo.id } }),
      prisma.puntajeRiesgo.createMany({
        data: puntajes.map((p) => ({
          estudianteId: p.estudianteId,
          periodoId: periodo.id,
          puntaje: p.prediccion.puntaje,
          nivel: p.prediccion.nivel,
          factores: factoresParaGuardar(p.prediccion) as unknown as Prisma.InputJsonValue,
          modeloVersion: modelo.version,
        })),
      }),
      prisma.alerta.createMany({
        data: nuevasAlertas.map((p) => ({ estudianteId: p.estudianteId, origen: "MODELO" as const, motivo: motivoAlertaModelo(p.prediccion) })),
      }),
    ]);

    return {
      estudiantes: puntajes.length,
      alto: puntajes.filter((p) => p.prediccion.nivel === "ALTO").length,
      medio: puntajes.filter((p) => p.prediccion.nivel === "MEDIO").length,
      alertasNuevas: nuevasAlertas.length,
      version: modelo.version,
    };
  }

  async listaPriorizada(f: FiltrosRiesgo): Promise<ListaPriorizada> {
    const periodo = await prisma.periodo.findFirst({ where: { activo: true } });
    const busqueda = f.busqueda?.trim();
    const filtroEstudiante: Prisma.EstudianteWhereInput = {
      ...(f.programaId ? { programaId: f.programaId } : {}),
      ...(busqueda
        ? {
            OR: [
              { codigo: { contains: busqueda, mode: "insensitive" } },
              { nombres: { contains: busqueda, mode: "insensitive" } },
              { apellidos: { contains: busqueda, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(f.conAlerta ? { alertas: { some: { estado: { not: "CERRADA" } } } } : {}),
    };
    const where: Prisma.PuntajeRiesgoWhereInput = {
      periodoId: periodo?.id ?? "__sin_periodo__",
      ...(f.nivel ? { nivel: f.nivel } : {}),
      estudiante: filtroEstudiante,
    };
    const whereResumen: Prisma.PuntajeRiesgoWhereInput = { periodoId: periodo?.id ?? "__sin_periodo__", estudiante: filtroEstudiante };

    const [total, filas, porNivel, alertasAbiertas, ultimo, programas] = await Promise.all([
      prisma.puntajeRiesgo.count({ where }),
      prisma.puntajeRiesgo.findMany({
        where,
        orderBy: [{ puntaje: "desc" }, { estudiante: { codigo: "asc" } }],
        skip: (f.pagina - 1) * f.porPagina,
        take: f.porPagina,
        select: {
          puntaje: true,
          nivel: true,
          factores: true,
          estudiante: {
            select: {
              id: true,
              codigo: true,
              nombres: true,
              apellidos: true,
              semestreActual: true,
              estado: true,
              programa: { select: { nombre: true } },
              _count: { select: { alertas: { where: { estado: { not: "CERRADA" } } }, intervenciones: true } },
            },
          },
        },
      }),
      prisma.puntajeRiesgo.groupBy({ by: ["nivel"], where: whereResumen, _count: { _all: true } }),
      prisma.alerta.count({ where: { estado: { not: "CERRADA" }, estudiante: filtroEstudiante } }),
      prisma.puntajeRiesgo.findFirst({ where: { periodoId: periodo?.id }, orderBy: { calculadoEn: "desc" }, select: { calculadoEn: true, modeloVersion: true } }),
      prisma.programa.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    ]);
    const modelo = await this.modeloActivo();
    const cuenta = (n: NivelRiesgo) => porNivel.find((x) => x.nivel === n)?._count._all ?? 0;

    return {
      filas: filas.map((p) => {
        const factores = (p.factores as unknown as Factor[]) ?? [];
        return {
          estudianteId: p.estudiante.id,
          codigo: p.estudiante.codigo,
          nombre: `${p.estudiante.nombres} ${p.estudiante.apellidos}`,
          programa: p.estudiante.programa.nombre,
          semestre: p.estudiante.semestreActual,
          estado: p.estudiante.estado,
          puntaje: p.puntaje,
          nivel: p.nivel,
          principales: factores.filter((x) => x.aporte > 0.05).slice(0, 2).map((x) => ModeloRiesgo.describir(x).split(" (")[0]),
          alertasAbiertas: p.estudiante._count.alertas,
          intervenciones: p.estudiante._count.intervenciones,
        };
      }),
      total,
      pagina: f.pagina,
      paginas: Math.max(1, Math.ceil(total / f.porPagina)),
      resumen: { ALTO: cuenta("ALTO"), MEDIO: cuenta("MEDIO"), BAJO: cuenta("BAJO"), alertasAbiertas },
      modelo: { version: ultimo?.modeloVersion ?? modelo.version, origen: modelo.definicion.origen, calculadoEn: ultimo?.calculadoEn.toISOString() ?? null },
      periodo: periodo?.codigo ?? null,
      programas,
    };
  }

  /** Ficha individual del estudiante para Bienestar (acceso auditado, Ley 1581) */
  async detalle(estudianteId: string, solicitante: { usuarioId: string; rol: string }) {
    const e = await prisma.estudiante.findUnique({
      where: { id: estudianteId },
      include: {
        programa: { select: { nombre: true, duracionSemestres: true } },
        financiaciones: { select: { tipo: true, porcentajeCubierto: true, saldoPendiente: true } },
        notas: { select: { semestre: true, promedio: true, materiasPerdidas: true, asistenciaPct: true, periodo: { select: { codigo: true, activo: true } } }, orderBy: { semestre: "asc" } },
        puntajes: { orderBy: { calculadoEn: "desc" }, take: 1, include: { periodo: { select: { codigo: true } } } },
        alertas: {
          orderBy: { creadaEn: "desc" },
          include: { creadaPor: { select: { nombre: true } }, curso: { select: { codigo: true, nombre: true } } },
        },
        encuestas: { orderBy: { fecha: "desc" }, take: 3, select: { id: true, fecha: true, puntaje: true, nivel: true, puntajesDimension: true, autorizaContacto: true } },
        inscripciones: {
          where: { curso: { periodo: { activo: true } } },
          include: { curso: { select: { codigo: true, nombre: true, docente: { select: { nombre: true } } } } },
        },
        intervenciones: { orderBy: { fecha: "desc" }, include: { responsable: { select: { nombre: true } } } },
        retiro: { include: { causa: { select: { nombre: true, categoria: true } } } },
      },
    });
    if (!e) throw new ErrorApi(404, "No se encontró el estudiante.");
    await new ServicioAuditoria().registrar({ usuarioId: solicitante.usuarioId, rol: solicitante.rol, accion: "CONSULTA_FICHA", recurso: e.hashAnonimo });

    const puntaje = e.puntajes[0] ?? null;
    const modelo = await this.modeloActivo();
    return {
      estudiante: {
        id: e.id,
        codigo: e.codigo,
        nombre: `${e.nombres} ${e.apellidos}`,
        programa: e.programa.nombre,
        duracionSemestres: e.programa.duracionSemestres,
        semestreActual: e.semestreActual,
        estado: e.estado,
        cohorte: e.cohorte,
        estrato: e.estrato,
        municipio: e.municipioOrigen,
        trabaja: e.trabaja,
        horasTrabajoSemana: e.horasTrabajoSemana,
        financiaciones: e.financiaciones,
      },
      puntaje: puntaje
        ? {
            puntaje: puntaje.puntaje,
            nivel: puntaje.nivel,
            periodo: puntaje.periodo?.codigo ?? null,
            modeloVersion: puntaje.modeloVersion,
            calculadoEn: puntaje.calculadoEn.toISOString(),
            factores: (puntaje.factores as unknown as Factor[]) ?? [],
            probabilidadPromedio: Math.round((1 / (1 + Math.exp(-modelo.definicion.intercepto))) * 100),
            umbrales: { medio: Math.round(modelo.definicion.umbrales.medio * 100), alto: Math.round(modelo.definicion.umbrales.alto * 100) },
          }
        : null,
      notas: e.notas.map((n) => ({ semestre: n.semestre, periodo: n.periodo.codigo, enCurso: n.periodo.activo, promedio: n.promedio, materiasPerdidas: n.materiasPerdidas, asistenciaPct: n.asistenciaPct })),
      alertas: e.alertas.map((a) => ({
        id: a.id,
        origen: a.origen,
        motivo: a.motivo,
        estado: a.estado,
        creadaEn: a.creadaEn.toISOString(),
        creadaPor: a.creadaPor?.nombre ?? null,
        curso: a.curso ? `${a.curso.codigo} ${a.curso.nombre}` : null,
      })),
      encuestas: e.encuestas.map((x) => ({ ...x, fecha: x.fecha.toISOString() })),
      cursos: e.inscripciones.map((i) => ({ codigo: i.curso.codigo, nombre: i.curso.nombre, docente: i.curso.docente.nombre, notaParcial: i.notaParcial, asistenciaPct: i.asistenciaPct, fallas: i.fallas })),
      intervenciones: e.intervenciones.map((i) => ({ id: i.id, tipo: i.tipo, fecha: i.fecha.toISOString(), descripcion: i.descripcion, estado: i.estado, montoApoyo: i.montoApoyo, responsable: i.responsable.nombre })),
      retiro: e.retiro ? { semestre: e.retiro.semestreRetiro, causa: e.retiro.causa.nombre, categoria: e.retiro.causa.categoria } : null,
    };
  }
}

export type DetalleRiesgo = Awaited<ReturnType<ServicioRiesgo["detalle"]>>;
