import type { EstadoIntervencion, Prisma, TipoIntervencion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { Rol } from "@/lib/roles";
import type { ActualizarIntervencion, CrearIntervencion, FiltrosIntervenciones } from "@/lib/validators/intervenciones";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { ServicioRiesgo } from "@/services/riesgo/ServicioRiesgo";
import { cargarRegistros } from "@/services/riesgo/registros";
import { construirPanel } from "@/services/riesgo/caracteristicas";
import { AnalizadorIntervenciones, type Observacion, type ResultadoEfectividad, type TipoIntervencionAnalisis } from "./AnalizadorIntervenciones";

export interface FilaIntervencion {
  id: string;
  estudianteId: string;
  codigo: string;
  estudiante: string;
  programa: string;
  tipo: TipoIntervencion;
  estado: EstadoIntervencion;
  fecha: string;
  periodo: string | null;
  descripcion: string;
  resultado: string | null;
  montoApoyo: number | null;
  responsable: string;
  /** Situación ACTUAL del estudiante (permite ver si siguió estudiando) */
  estadoEstudiante: string;
}

export interface ListaIntervenciones {
  filas: FilaIntervencion[];
  total: number;
  pagina: number;
  paginas: number;
  resumen: { EN_CURSO: number; COMPLETADA: number; CANCELADA: number; montoTotal: number };
}

export interface EfectividadIntervenciones extends ResultadoEfectividad {
  modeloVersion: string;
  /** Primer periodo con intervenciones registradas (inicio del programa de acompañamiento) */
  desde: string | null;
}

interface Usuario {
  usuarioId: string;
  rol: Rol;
}

/**
 * Seguimiento de intervenciones de Bienestar y medición de su efectividad.
 * Solo ADMIN y BIENESTAR acceden (datos individuales, Ley 1581 de 2012).
 */
export class ServicioIntervenciones {
  private readonly auditoria = new ServicioAuditoria();

  async listar(f: FiltrosIntervenciones): Promise<ListaIntervenciones> {
    const where: Prisma.IntervencionWhereInput = {
      ...(f.estado ? { estado: f.estado } : {}),
      ...(f.tipo ? { tipo: f.tipo } : {}),
      ...(f.busqueda
        ? {
            estudiante: {
              OR: [
                { codigo: { contains: f.busqueda, mode: "insensitive" } },
                { nombres: { contains: f.busqueda, mode: "insensitive" } },
                { apellidos: { contains: f.busqueda, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [total, filas, porEstado, monto] = await Promise.all([
      prisma.intervencion.count({ where }),
      prisma.intervencion.findMany({
        where,
        orderBy: [{ fecha: "desc" }],
        skip: (f.pagina - 1) * f.porPagina,
        take: f.porPagina,
        include: {
          estudiante: { select: { id: true, codigo: true, nombres: true, apellidos: true, estado: true, programa: { select: { nombre: true } } } },
          responsable: { select: { nombre: true } },
          periodo: { select: { codigo: true } },
        },
      }),
      prisma.intervencion.groupBy({ by: ["estado"], where, _count: { _all: true } }),
      prisma.intervencion.aggregate({ where, _sum: { montoApoyo: true } }),
    ]);
    const cuenta = (e: EstadoIntervencion) => porEstado.find((p) => p.estado === e)?._count._all ?? 0;
    return {
      total,
      pagina: f.pagina,
      paginas: Math.max(1, Math.ceil(total / f.porPagina)),
      resumen: { EN_CURSO: cuenta("EN_CURSO"), COMPLETADA: cuenta("COMPLETADA"), CANCELADA: cuenta("CANCELADA"), montoTotal: monto._sum.montoApoyo ?? 0 },
      filas: filas.map((i) => ({
        id: i.id,
        estudianteId: i.estudiante.id,
        codigo: i.estudiante.codigo,
        estudiante: `${i.estudiante.nombres} ${i.estudiante.apellidos}`,
        programa: i.estudiante.programa.nombre,
        tipo: i.tipo,
        estado: i.estado,
        fecha: i.fecha.toISOString(),
        periodo: i.periodo?.codigo ?? null,
        descripcion: i.descripcion,
        resultado: i.resultado,
        montoApoyo: i.montoApoyo,
        responsable: i.responsable.nombre,
        estadoEstudiante: i.estudiante.estado,
      })),
    };
  }

  /** Registra una intervención en el periodo actual; si viene de una alerta, la pasa a seguimiento */
  async crear(datos: CrearIntervencion, usuario: Usuario): Promise<{ id: string }> {
    const estudiante = await prisma.estudiante.findFirst({
      where: datos.estudianteId ? { id: datos.estudianteId } : { codigo: datos.codigo },
      select: { id: true, hashAnonimo: true, estado: true },
    });
    if (!estudiante) throw new ErrorApi(404, "No se encontró un estudiante con ese código.");
    if (estudiante.estado === "GRADUADO" || estudiante.estado === "DESERTOR") {
      throw new ErrorApi(409, `El estudiante figura como ${estudiante.estado.toLowerCase()}: no se le pueden registrar intervenciones nuevas.`);
    }
    if (datos.alertaId) {
      const alerta = await prisma.alerta.findUnique({ where: { id: datos.alertaId }, select: { estudianteId: true } });
      if (!alerta || alerta.estudianteId !== estudiante.id) throw new ErrorApi(400, "La alerta no corresponde a este estudiante.");
    }
    const periodo = await prisma.periodo.findFirst({ where: { activo: true }, select: { id: true } });

    const creada = await prisma.$transaction(async (tx) => {
      const i = await tx.intervencion.create({
        data: {
          estudianteId: estudiante.id,
          responsableId: usuario.usuarioId,
          tipo: datos.tipo,
          descripcion: datos.descripcion,
          montoApoyo: datos.tipo === "APOYO_ECONOMICO" ? (datos.montoApoyo ?? null) : null,
          periodoId: periodo?.id ?? null,
          alertaId: datos.alertaId ?? null,
        },
        select: { id: true },
      });
      if (datos.alertaId) await tx.alerta.update({ where: { id: datos.alertaId }, data: { estado: "EN_SEGUIMIENTO" } });
      return i;
    });

    await this.auditoria.registrar({ usuarioId: usuario.usuarioId, rol: usuario.rol, accion: "INTERVENCION", recurso: estudiante.hashAnonimo, detalle: `Registro: ${datos.tipo}` });
    return creada;
  }

  /** Cambia el estado (cerrar o cancelar exige registrar el resultado) */
  async actualizar(id: string, datos: ActualizarIntervencion, usuario: Usuario): Promise<{ id: string; estado: EstadoIntervencion }> {
    const actual = await prisma.intervencion.findUnique({ where: { id }, select: { id: true, estudiante: { select: { hashAnonimo: true } } } });
    if (!actual) throw new ErrorApi(404, "La intervención no existe.");
    const r = await prisma.intervencion.update({
      where: { id },
      data: { estado: datos.estado, resultado: datos.resultado ?? null },
      select: { id: true, estado: true },
    });
    await this.auditoria.registrar({ usuarioId: usuario.usuarioId, rol: usuario.rol, accion: "INTERVENCION", recurso: actual.estudiante.hashAnonimo, detalle: `Estado: ${datos.estado}` });
    return r;
  }

  /**
   * Efectividad: arma una observación por estudiante-semestre (desde el primer periodo con
   * intervenciones) con su probabilidad de desertar según el modelo activo, si fue intervenido en ese
   * periodo y si permaneció (no desertó ese semestre ni el siguiente). El análisis estadístico lo hace
   * AnalizadorIntervenciones (clase pura y probada).
   */
  async efectividad(): Promise<EfectividadIntervenciones> {
    const [modelo, registros, notas, intervenciones] = await Promise.all([
      new ServicioRiesgo().modeloActivo(),
      cargarRegistros(prisma),
      prisma.notaSemestre.findMany({ select: { estudianteId: true, semestre: true, periodo: { select: { id: true, codigo: true, indice: true } } } }),
      prisma.intervencion.findMany({
        where: { periodoId: { not: null }, estado: { not: "CANCELADA" } },
        select: { estudianteId: true, periodoId: true, tipo: true, fecha: true },
        orderBy: { fecha: "asc" },
      }),
    ]);

    const periodoDe = new Map(notas.map((n) => [`${n.estudianteId}|${n.semestre}`, n.periodo]));
    const intervencionDe = new Map<string, TipoIntervencionAnalisis>();
    for (const i of intervenciones) {
      const clave = `${i.estudianteId}|${i.periodoId}`;
      if (!intervencionDe.has(clave)) intervencionDe.set(clave, i.tipo); // la primera del periodo
    }
    const periodos = new Map(notas.map((n) => [n.periodo.id, n.periodo]));
    const indicesConIntervencion = intervenciones.map((i) => periodos.get(i.periodoId ?? "")?.indice).filter((x): x is number => x !== undefined);
    const inicio = indicesConIntervencion.length ? Math.min(...indicesConIntervencion) : null;

    const observaciones: Observacion[] = [];
    if (inicio !== null) {
      for (const fila of construirPanel(registros)) {
        const periodo = periodoDe.get(`${fila.estudianteId}|${fila.semestre}`);
        if (!periodo || periodo.indice < inicio) continue;
        const tipo = intervencionDe.get(`${fila.estudianteId}|${periodo.id}`) ?? null;
        observaciones.push({
          probabilidad: modelo.predecir(fila.datos).probabilidad,
          intervenido: tipo !== null,
          tipo,
          permanecio: fila.y === 0,
          periodo: periodo.codigo,
        });
      }
    }

    const desde = inicio === null ? null : ([...periodos.values()].find((p) => p.indice === inicio)?.codigo ?? null);
    return { ...new AnalizadorIntervenciones().analizar(observaciones), modeloVersion: modelo.version, desde };
  }
}
