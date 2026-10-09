import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { ResponderEncuesta } from "@/lib/validators/encuesta";
import { EvaluadorEncuesta, type ResultadoEncuesta } from "./EvaluadorEncuesta";
import { DIMENSIONES, PREGUNTAS, RECURSOS, type Dimension } from "./preguntas";

export interface EncuestaGuardada {
  id: string;
  fecha: string;
  resultado: ResultadoEncuesta;
  autorizaContacto: boolean;
  alertaGenerada: boolean;
}

/** Encuesta de autoevaluación del estudiante (con consentimiento informado, Ley 1581 de 2012) */
export class ServicioEncuesta {
  async responder(estudianteId: string | null, datos: ResponderEncuesta): Promise<EncuestaGuardada> {
    if (!estudianteId) throw new ErrorApi(409, "Tu usuario no está asociado a un registro de estudiante.");
    const resultado = EvaluadorEncuesta.evaluar(datos.respuestas);

    // Solo se avisa a Bienestar si el estudiante lo autorizó expresamente
    const alertaGenerada = resultado.nivel === "ALTO" && datos.autorizaContacto;
    const encuesta = await prisma.$transaction(async (tx) => {
      const e = await tx.encuesta.create({
        data: {
          estudianteId,
          consentimiento: true,
          autorizaContacto: datos.autorizaContacto,
          puntaje: resultado.puntaje,
          nivel: resultado.nivel,
          puntajesDimension: resultado.puntajesDimension,
          respuestas: { create: PREGUNTAS.map((p) => ({ clave: p.clave, dimension: p.dimension, valor: datos.respuestas[p.clave] })) },
        },
        select: { id: true, fecha: true },
      });
      if (alertaGenerada) {
        const critica = DIMENSIONES[resultado.dimensionesCriticas[0]].titulo.toLowerCase();
        await tx.alerta.create({
          data: {
            estudianteId,
            origen: "ENCUESTA",
            motivo: `Encuesta de autoevaluación con riesgo ALTO (${resultado.puntaje}/100). Dimensión más crítica: ${critica}.${resultado.intencionRetiro ? " Manifestó que ha pensado en retirarse." : ""} El estudiante autorizó ser contactado.`,
          },
        });
      }
      return e;
    });
    return { id: encuesta.id, fecha: encuesta.fecha.toISOString(), resultado, autorizaContacto: datos.autorizaContacto, alertaGenerada };
  }

  /** Historial del propio estudiante; reconstruye recursos con las reglas vigentes */
  async historial(estudianteId: string | null) {
    if (!estudianteId) return [];
    const filas = await prisma.encuesta.findMany({
      where: { estudianteId },
      orderBy: { fecha: "desc" },
      take: 5,
      select: { id: true, fecha: true, puntaje: true, nivel: true, puntajesDimension: true, autorizaContacto: true },
    });
    return filas.map((f) => {
      const dims = (f.puntajesDimension ?? {}) as Record<Dimension, number>;
      const criticas = (Object.keys(DIMENSIONES) as Dimension[]).sort((a, b) => (dims[b] ?? 0) - (dims[a] ?? 0));
      return {
        id: f.id,
        fecha: f.fecha.toISOString(),
        puntaje: f.puntaje ?? 0,
        nivel: f.nivel ?? "BAJO",
        puntajesDimension: dims,
        autorizaContacto: f.autorizaContacto,
        recursos: RECURSOS.filter((r) => r.dimension === criticas[0] || (dims[r.dimension] ?? 0) >= EvaluadorEncuesta.UMBRAL_RECURSO),
      };
    });
  }
}
