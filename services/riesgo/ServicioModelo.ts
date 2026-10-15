import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { ModeloRiesgo } from "./ModeloRiesgo";
import { Reentrenador, type ComparacionModelos, type Recomendacion } from "./Reentrenador";
import { ServicioRiesgo } from "./ServicioRiesgo";
import { cargarRegistros } from "./registros";

export interface VersionModeloDTO {
  id: string;
  version: string;
  origen: string;
  activo: boolean;
  creadoEn: string;
  entrenadoPor: string | null;
  /** Métricas en la muestra de prueba (fuera de muestra) */
  auc: number | null;
  brier: number | null;
  sensibilidadAlto: number | null;
  precisionAlto: number | null;
  tasaBase: number | null;
  filasPrueba: number | null;
  C: number | null;
  recomendacion: Recomendacion | null;
  motivo: string | null;
  comparacion: ComparacionModelos | null;
  coeficientesPrincipales: { clave: string; etiqueta: string; coeficiente: number }[];
}

export interface ResumenModelos {
  versiones: VersionModeloDTO[];
  activo: VersionModeloDTO | null;
  puntajes: { total: number; calculadoEn: string | null; version: string | null };
}

interface Actor {
  usuarioId: string;
  rol: string;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Gestión de versiones del modelo de riesgo desde el panel de administración:
 * listar, reentrenar con los datos actuales de la BD y activar una versión (o volver a una anterior).
 * Cada entrenamiento y activación queda en la auditoría.
 */
export class ServicioModelo {
  private readonly auditoria = new ServicioAuditoria();

  async listar(): Promise<ResumenModelos> {
    const [filas, ultimoPuntaje, totalPuntajes] = await Promise.all([
      prisma.modeloRiesgo.findMany({ orderBy: { creadoEn: "desc" }, include: { entrenadoPor: { select: { nombre: true } } } }),
      prisma.puntajeRiesgo.findFirst({ orderBy: { calculadoEn: "desc" }, select: { calculadoEn: true, modeloVersion: true } }),
      prisma.puntajeRiesgo.count({ where: { periodo: { activo: true } } }),
    ]);
    const versiones = filas.map((f) => ServicioModelo.aDTO(f));
    return {
      versiones,
      activo: versiones.find((v) => v.activo) ?? null,
      puntajes: { total: totalPuntajes, calculadoEn: ultimoPuntaje?.calculadoEn.toISOString() ?? null, version: ultimoPuntaje?.modeloVersion ?? null },
    };
  }

  /** Entrena una versión nueva (queda INACTIVA hasta que el administrador la active) */
  async entrenar(C: number, actor: Actor): Promise<VersionModeloDTO> {
    const fecha = new Date();
    let version = Reentrenador.nombreVersion(fecha);
    if (await prisma.modeloRiesgo.findUnique({ where: { version }, select: { id: true } })) version = `${version}-${fecha.getMilliseconds()}`;

    const [registros, actual] = await Promise.all([cargarRegistros(prisma), new ServicioRiesgo().modeloActivo()]);
    let resultado;
    try {
      resultado = new Reentrenador({ version, C, fecha }).entrenar(registros, actual);
    } catch (e) {
      throw new ErrorApi(422, e instanceof Error ? e.message : "No fue posible entrenar el modelo.");
    }

    const fila = await prisma.modeloRiesgo.create({
      data: {
        version,
        origen: "ENTRENAMIENTO_ADMIN",
        definicion: resultado.definicion as unknown as Prisma.InputJsonValue,
        metricas: {
          ...resultado.metricas,
          comparacion: resultado.comparacion,
          recomendacion: resultado.recomendacion,
          motivo: resultado.motivo,
          coeficientesPrincipales: resultado.coeficientesPrincipales,
        } as unknown as Prisma.InputJsonValue,
        activo: false,
        entrenadoPorId: actor.usuarioId,
      },
      include: { entrenadoPor: { select: { nombre: true } } },
    });

    const auc = resultado.metricas.auc.toLocaleString("es-CO", { maximumFractionDigits: 3 });
    await this.auditoria.registrar({
      ...actor,
      accion: "ADMIN_MODELO",
      recurso: version,
      detalle: `Entrenó una versión nueva con ${resultado.metricas.estudiantes} estudiantes (C=${C}; AUC en prueba ${auc}; recomendación ${resultado.recomendacion}).`,
    });
    return ServicioModelo.aDTO(fila);
  }

  /**
   * Activa una versión (desactiva las demás en la misma transacción) y, por defecto, recalcula
   * los puntajes de los estudiantes activos para que la alerta temprana use el modelo nuevo.
   */
  async activar(id: string, actor: Actor, recalcular = true) {
    const fila = await prisma.modeloRiesgo.findUnique({ where: { id } });
    if (!fila) throw new ErrorApi(404, "La versión del modelo no existe.");
    try {
      new ModeloRiesgo(fila.definicion); // no se activa una definición corrupta
    } catch {
      throw new ErrorApi(422, "La definición guardada de esta versión no es válida; no se puede activar.");
    }

    const anterior = await prisma.modeloRiesgo.findFirst({ where: { activo: true }, select: { version: true } });
    if (!fila.activo) {
      await prisma.$transaction([
        prisma.modeloRiesgo.updateMany({ where: { activo: true }, data: { activo: false } }),
        prisma.modeloRiesgo.update({ where: { id }, data: { activo: true } }),
      ]);
      await this.auditoria.registrar({
        ...actor,
        accion: "ADMIN_MODELO",
        recurso: fila.version,
        detalle: `Activó la versión ${fila.version}${anterior ? ` (reemplaza a ${anterior.version})` : ""}.`,
      });
    }

    const recalculo = recalcular ? await new ServicioRiesgo().recalcularPuntajes() : null;
    return { version: fila.version, anterior: anterior?.version ?? null, yaEstabaActiva: fila.activo, recalculo };
  }

  static aDTO(f: {
    id: string;
    version: string;
    origen: string;
    activo: boolean;
    creadoEn: Date;
    metricas: Prisma.JsonValue;
    entrenadoPor: { nombre: string } | null;
  }): VersionModeloDTO {
    const m = (f.metricas && typeof f.metricas === "object" && !Array.isArray(f.metricas) ? f.metricas : {}) as Record<string, unknown>;
    const recomendacion = m.recomendacion === "ACTIVAR" || m.recomendacion === "REVISAR" || m.recomendacion === "NO_ACTIVAR" ? m.recomendacion : null;
    return {
      id: f.id,
      version: f.version,
      origen: f.origen,
      activo: f.activo,
      creadoEn: f.creadoEn.toISOString(),
      entrenadoPor: f.entrenadoPor?.nombre ?? null,
      auc: num(m.auc),
      brier: num(m.brier),
      sensibilidadAlto: num(m.sensibilidadAlto),
      precisionAlto: num(m.precisionAlto),
      tasaBase: num(m.tasaBase),
      filasPrueba: num(m.n),
      C: num(m.C),
      recomendacion,
      motivo: typeof m.motivo === "string" ? m.motivo : null,
      comparacion: (m.comparacion as ComparacionModelos | undefined) ?? null,
      coeficientesPrincipales: Array.isArray(m.coeficientesPrincipales) ? (m.coeficientesPrincipales as VersionModeloDTO["coeficientesPrincipales"]) : [],
    };
  }
}
