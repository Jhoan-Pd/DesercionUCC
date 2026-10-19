import { manejar, leerJson } from "@/lib/api";
import { codigoSchema } from "@/lib/validators/estudiantes";
import { explicacionSchema } from "@/lib/validators/agente";
import { ServicioExplicacion } from "@/services/agente/ServicioExplicacion";

export const maxDuration = 60;

/** Genera (o devuelve guardada) la explicación del riesgo redactada por el agente */
export const POST = manejar(["ADMIN", "BIENESTAR"], async ({ req, params }) => {
  const { regenerar } = await leerJson(req, explicacionSchema);
  return new ServicioExplicacion().generar(codigoSchema.parse(decodeURIComponent(params.codigo)), regenerar === true);
});
