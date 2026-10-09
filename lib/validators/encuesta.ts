import { z } from "zod";
import "./zod-es";
import { PREGUNTAS } from "@/services/encuesta/preguntas";

const likert = z.number().int().min(1, "Elige una opción de 1 a 5").max(5, "Elige una opción de 1 a 5");

export const responderEncuestaSchema = z.object({
  /** Ley 1581 de 2012: sin consentimiento informado no se guarda nada */
  consentimiento: z.literal(true, { errorMap: () => ({ message: "Debes aceptar el tratamiento de datos para responder la encuesta" }) }),
  autorizaContacto: z.boolean().default(false),
  respuestas: z.object(Object.fromEntries(PREGUNTAS.map((p) => [p.clave, likert])) as Record<string, typeof likert>),
});
export type ResponderEncuesta = z.infer<typeof responderEncuestaSchema>;
