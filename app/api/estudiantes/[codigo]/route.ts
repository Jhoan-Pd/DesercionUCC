import { manejar, ErrorApi } from "@/lib/api";
import { codigoSchema } from "@/lib/validators/estudiantes";
import { ServicioEstudiantes } from "@/services/estudiantes/ServicioEstudiantes";

/** Ficha de un estudiante con su evaluación de riesgo */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ params }) => {
  const detalle = await new ServicioEstudiantes().detalle(codigoSchema.parse(decodeURIComponent(params.codigo)));
  if (!detalle) throw new ErrorApi(404, "No existe un estudiante con ese código.");
  return detalle;
});
