import type { Estudiante, Evaluacion, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { puntajePorFactores, type FactorRiesgo, type ResultadoRiesgo } from "./factores";
import { definicionModeloSchema, entrenarModelo, predecirConModelo, MINIMO_ENTRENAMIENTO, type DefinicionModelo, type MetricasEntrenamiento } from "./modelo";
import type { DatosEstudiante } from "./variables";

export interface EstadoModelo {
  /** Método con el que se calcula hoy el riesgo */
  metodo: "FACTORES" | "MODELO";
  version: string | null;
  metricas: MetricasEntrenamiento | null;
  /** Explicación para mostrar en pantalla */
  motivo: string;
  conResultado: number;
  minimo: number;
}

export function datosDe(e: Pick<Estudiante, "semestre" | "promedio" | "materiasPerdidas" | "asistencia" | "estrato" | "trabaja" | "apoyoFinanciero" | "moraMatricula" | "puntajeSaber11" | "edad">): DatosEstudiante {
  return {
    semestre: e.semestre,
    promedio: e.promedio,
    materiasPerdidas: e.materiasPerdidas,
    asistencia: e.asistencia,
    estrato: e.estrato,
    trabaja: e.trabaja,
    apoyoFinanciero: e.apoyoFinanciero,
    moraMatricula: e.moraMatricula,
    puntajeSaber11: e.puntajeSaber11,
    edad: e.edad,
  };
}

/** Calcula el riesgo con el modelo activo si existe; si no, con el puntaje por factores */
export function evaluar(datos: DatosEstudiante, modelo: DefinicionModelo | null): ResultadoRiesgo {
  return modelo ? predecirConModelo(modelo, datos) : puntajePorFactores(datos);
}

/** Firma comparable de un resultado (JSONB no conserva el orden de las claves, por eso se arma a mano) */
function firma(r: Pick<Evaluacion, "puntaje" | "nivel" | "metodo" | "modeloVersion" | "factores" | "faltantes"> | ResultadoRiesgo): string {
  const factores = (Array.isArray(r.factores) ? (r.factores as unknown as FactorRiesgo[]) : []).map((f) => [f.clave, f.etiqueta, f.puntos, f.detalle]);
  return JSON.stringify([r.puntaje, r.nivel, r.metodo, r.modeloVersion ?? null, factores, [...r.faltantes].sort()]);
}

const LOTE = 1000;

/**
 * Calcula y guarda el riesgo de los estudiantes ACTIVOS. Si el resultado de un estudiante no cambió,
 * su evaluación (y la explicación ya redactada por el agente) se conserva tal cual.
 */
export class ServicioEvaluacion {
  async modeloActivo(): Promise<DefinicionModelo | null> {
    const fila = await prisma.modeloRiesgo.findFirst({ where: { activo: true }, orderBy: { creadoEn: "desc" } });
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
   * al puntaje por factores.
   */
  async entrenar(fecha = new Date()): Promise<{ estado: "INSUFICIENTE" | "ACTIVADO" | "NO_ACTIVADO"; motivo: string }> {
    const conResultado = await prisma.estudiante.findMany({ where: { estado: { in: ["RETIRADO", "GRADUADO"] } } });
    const version = `ucc-${fecha.toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
    const r = entrenarModelo(
      conResultado.map((e) => ({ codigo: e.codigo, datos: datosDe(e), retirado: e.estado === "RETIRADO" })),
      version,
      fecha,
    );
    if (r.estado === "INSUFICIENTE") {
      await prisma.modeloRiesgo.updateMany({ where: { activo: true }, data: { activo: false } });
      return { estado: "INSUFICIENTE", motivo: r.motivo };
    }
    await prisma.$transaction([
      prisma.modeloRiesgo.updateMany({ where: { activo: true }, data: { activo: false } }),
      prisma.modeloRiesgo.create({
        data: {
          version,
          definicion: r.definicion as unknown as Prisma.InputJsonValue,
          metricas: { ...r.metricas, motivo: r.motivo } as unknown as Prisma.InputJsonValue,
          activo: r.activable,
        },
      }),
    ]);
    return { estado: r.activable ? "ACTIVADO" : "NO_ACTIVADO", motivo: r.motivo };
  }

  async recalcular(): Promise<{ evaluados: number; cambiaron: number }> {
    const modelo = await this.modeloActivo();
    const estudiantes = await prisma.estudiante.findMany({ where: { estado: "ACTIVO" }, include: { evaluacion: true } });

    const nuevas: Prisma.EvaluacionCreateManyInput[] = [];
    for (const e of estudiantes) {
      const r = evaluar(datosDe(e), modelo);
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
      await prisma.$transaction([prisma.evaluacion.deleteMany({ where: { estudianteId: { in: lote.map((n) => n.estudianteId) } } }), prisma.evaluacion.createMany({ data: lote })]);
    }
    // Quien ya no está activo (retirado o graduado) no necesita alerta
    await prisma.evaluacion.deleteMany({ where: { estudiante: { estado: { not: "ACTIVO" } } } });
    return { evaluados: estudiantes.length, cambiaron: nuevas.length };
  }
}
