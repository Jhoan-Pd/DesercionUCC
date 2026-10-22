import type { Evaluacion, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearCalculadora } from "./calculadora";
import type { MetodoRiesgo, ResultadoRiesgo } from "./factores";
import { definicionModeloSchema, entrenarModelo, MINIMO_ENTRENAMIENTO, type DefinicionModelo, type MetricasEntrenamiento } from "./modelo";
import { factoresDe } from "./persistencia";
import { datosDe } from "./variables";

export interface EstadoModelo {
  /** Método con el que se calcula hoy el riesgo */
  metodo: MetodoRiesgo;
  version: string | null;
  metricas: MetricasEntrenamiento | null;
  /** Explicación para mostrar en pantalla */
  motivo: string;
  conResultado: number;
  minimo: number;
}

/** Firma comparable de un resultado (JSONB no conserva el orden de las claves, por eso se arma a mano) */
function firma(r: Pick<Evaluacion, "puntaje" | "nivel" | "metodo" | "modeloVersion" | "factores" | "faltantes"> | ResultadoRiesgo): string {
  const factores = factoresDe(r.factores).map((f) => [f.clave, f.etiqueta, f.puntos, f.detalle]);
  return JSON.stringify([r.puntaje, r.nivel, r.metodo, r.modeloVersion ?? null, factores, [...r.faltantes].sort()]);
}

const LOTE = 1000;

/** Cliente de Prisma o transacción en curso (los dos tienen las mismas consultas) */
export type ClienteBD = Prisma.TransactionClient;

/**
 * Calcula y guarda el riesgo de los estudiantes ACTIVOS. Si el resultado de un estudiante no cambió,
 * su evaluación (y la explicación ya redactada por el agente) se conserva tal cual.
 */
export class ServicioEvaluacion {
  async modeloActivo(db: ClienteBD = prisma): Promise<DefinicionModelo | null> {
    const fila = await db.modeloRiesgo.findFirst({ where: { activo: true }, orderBy: { creadoEn: "desc" } });
    if (!fila) return null;
    const def = definicionModeloSchema.safeParse(fila.definicion);
    return def.success ? (def.data as DefinicionModelo) : null;
  }

  async estadoModelo(): Promise<EstadoModelo> {
    const [activo, ultimo, conResultado] = await Promise.all([
      prisma.modeloRiesgo.findFirst({ where: { activo: true }, orderBy: { creadoEn: "desc" } }),
      prisma.modeloRiesgo.findFirst({ orderBy: { creadoEn: "desc" } }),
      prisma.estudiante.count({ where: { estado: { in: ["RETIRADO", "GRADUADO"] } } }),
    ]);
    const metricasDe = (m: Prisma.JsonValue) => (m && typeof m === "object" && !Array.isArray(m) ? (m as unknown as MetricasEntrenamiento & { motivo?: string }) : null);
    if (activo) {
      const m = metricasDe(activo.metricas);
      return { metodo: "MODELO", version: activo.version, metricas: m, motivo: m?.motivo ?? "Modelo entrenado con estudiantes de la UCC.", conResultado, minimo: MINIMO_ENTRENAMIENTO };
    }
    const m = ultimo ? metricasDe(ultimo.metricas) : null;
    const motivo =
      m?.motivo ??
      `Todavía no hay suficientes estudiantes con resultado conocido para entrenar un modelo con datos de la UCC (${conResultado} de ${MINIMO_ENTRENAMIENTO}). Mientras tanto se usa el puntaje por factores.`;
    return { metodo: "FACTORES", version: null, metricas: m, motivo, conResultado, minimo: MINIMO_ENTRENAMIENTO };
  }

  /**
   * Entrena con los estudiantes RETIRADOS y GRADUADOS. Si el modelo pasa la evaluación se activa
   * (y desactiva los anteriores); si no pasa, se guarda inactivo para dejar constancia y se vuelve
   * al puntaje por factores. Recibe la transacción de la carga: o se guarda todo, o nada.
   */
  async entrenar(tx: ClienteBD, fecha = new Date()): Promise<{ estado: "INSUFICIENTE" | "ACTIVADO" | "NO_ACTIVADO"; motivo: string }> {
    const conResultado = await tx.estudiante.findMany({ where: { estado: { in: ["RETIRADO", "GRADUADO"] } } });
    const version = `ucc-${fecha.toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
    const r = entrenarModelo(
      conResultado.map((e) => ({ codigo: e.codigo, datos: datosDe(e), retirado: e.estado === "RETIRADO" })),
      version,
      fecha,
    );
    await tx.modeloRiesgo.updateMany({ where: { activo: true }, data: { activo: false } });
    if (r.estado === "INSUFICIENTE") return { estado: "INSUFICIENTE", motivo: r.motivo };
    await tx.modeloRiesgo.create({
      data: {
        version,
        definicion: r.definicion as unknown as Prisma.InputJsonValue,
        metricas: { ...r.metricas, motivo: r.motivo } as unknown as Prisma.InputJsonValue,
        activo: r.activable,
      },
    });
    return { estado: r.activable ? "ACTIVADO" : "NO_ACTIVADO", motivo: r.motivo };
  }

  /** Recalcula el riesgo de los estudiantes activos dentro de la transacción recibida */
  async recalcular(tx: ClienteBD): Promise<{ evaluados: number; cambiaron: number }> {
    const calculadora = crearCalculadora(await this.modeloActivo(tx));
    const estudiantes = await tx.estudiante.findMany({ where: { estado: "ACTIVO" }, include: { evaluacion: true } });

    const nuevas: Prisma.EvaluacionCreateManyInput[] = [];
    for (const e of estudiantes) {
      const r = calculadora.evaluar(datosDe(e));
      if (e.evaluacion && firma(e.evaluacion) === firma(r)) continue;
      nuevas.push({
        estudianteId: e.id,
        puntaje: r.puntaje,
        nivel: r.nivel,
        metodo: r.metodo,
        modeloVersion: r.modeloVersion,
        factores: r.factores as unknown as Prisma.InputJsonValue,
        faltantes: r.faltantes,
      });
    }
    for (let i = 0; i < nuevas.length; i += LOTE) {
      const lote = nuevas.slice(i, i + LOTE);
      await tx.evaluacion.deleteMany({ where: { estudianteId: { in: lote.map((n) => n.estudianteId) } } });
      await tx.evaluacion.createMany({ data: lote });
    }
    // Quien ya no está activo (retirado o graduado) no necesita alerta
    await tx.evaluacion.deleteMany({ where: { estudiante: { estado: { not: "ACTIVO" } } } });
    return { evaluados: estudiantes.length, cambiaron: nuevas.length };
  }
}
