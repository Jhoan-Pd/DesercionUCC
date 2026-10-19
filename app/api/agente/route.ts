import { manejar, leerJson, ErrorApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ClienteGemini, ErrorIA } from "@/lib/ia/gemini";
import { preguntaAgenteSchema } from "@/lib/validators/agente";
import { Agente } from "@/services/agente/Agente";
import { HerramientasBD } from "@/services/agente/herramientas";

export const maxDuration = 60;

/** ¿Está configurado el agente? (para mostrar el aviso en la página) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async () => ({ disponible: ClienteGemini.desdeEntorno() !== null }));

/** Pregunta al agente. La respuesta incluye los estudiantes mencionados con su nombre (que nunca se envía a Gemini). */
export const POST = manejar(["ADMIN", "BIENESTAR"], async ({ req }) => {
  const { pregunta, historial } = await leerJson(req, preguntaAgenteSchema);
  const cliente = ClienteGemini.desdeEntorno();
  if (!cliente) throw new ErrorApi(503, "El agente de IA no está configurado: falta la variable GEMINI_API_KEY en el servidor.");
  try {
    const r = await new Agente(cliente, new HerramientasBD()).responder(pregunta, historial);
    const estudiantes = r.codigos.length
      ? await prisma.estudiante.findMany({ where: { codigo: { in: r.codigos } }, select: { codigo: true, nombre: true, programa: true, evaluacion: { select: { nivel: true, puntaje: true } } } })
      : [];
    return {
      respuesta: r.respuesta,
      modelo: r.modelo,
      herramientas: r.herramientas,
      estudiantes: r.codigos
        .map((c) => estudiantes.find((e) => e.codigo === c))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((e) => ({ codigo: e.codigo, nombre: e.nombre, programa: e.programa, nivel: e.evaluacion?.nivel ?? null, puntaje: e.evaluacion?.puntaje ?? null })),
    };
  } catch (e) {
    if (e instanceof ErrorIA) throw new ErrorApi(e.estado, e.message);
    throw e;
  }
});
