import { manejar } from "@/lib/api";
import { idSchema } from "@/lib/validators/riesgo";
import { ServicioRiesgo } from "@/services/riesgo/ServicioRiesgo";

export const dynamic = "force-dynamic";

/** GET /api/riesgo/:id — ficha de riesgo de un estudiante (acceso individual auditado) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ params, session }) => {
  const { id } = idSchema.parse(params);
  return new ServicioRiesgo().detalle(id, { usuarioId: session.user.id, rol: session.user.rol });
});
