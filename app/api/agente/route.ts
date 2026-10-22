import { manejar, leerJson } from "@/lib/api";
import { preguntaAgenteSchema } from "@/lib/validators/agente";
import { ServicioAgente } from "@/services/agente/ServicioAgente";

export const maxDuration = 60;

/** ¿Está configurado el agente? (para mostrar el aviso en la página) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async () => ({ disponible: new ServicioAgente().disponible }));

/** Pregunta al agente. La respuesta incluye los estudiantes mencionados con su nombre (que nunca se envía a Gemini). */
export const POST = manejar(["ADMIN", "BIENESTAR"], async ({ req }) => {
  const { pregunta, historial } = await leerJson(req, preguntaAgenteSchema);
  return new ServicioAgente().preguntar(pregunta, historial);
});
