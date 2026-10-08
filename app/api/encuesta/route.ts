import { manejar, leerJson } from "@/lib/api";
import { responderEncuestaSchema } from "@/lib/validators/encuesta";
import { ServicioEncuesta } from "@/services/encuesta/ServicioEncuesta";

export const dynamic = "force-dynamic";

/** GET /api/encuesta — historial del propio estudiante */
export const GET = manejar(["ESTUDIANTE"], async ({ session }) => ({ historial: await new ServicioEncuesta().historial(session.user.estudianteId) }));

/** POST /api/encuesta — responde la encuesta (requiere consentimiento informado) */
export const POST = manejar(["ESTUDIANTE"], async ({ req, session }) => {
  const datos = await leerJson(req, responderEncuestaSchema);
  return new ServicioEncuesta().responder(session.user.estudianteId, datos);
});
