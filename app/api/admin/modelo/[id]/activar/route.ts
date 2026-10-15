import { manejar, leerJson } from "@/lib/api";
import { activarModeloSchema } from "@/lib/validators/modelo";
import { idSchema } from "@/lib/validators/riesgo";
import { ServicioModelo } from "@/services/riesgo/ServicioModelo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/admin/modelo/:id/activar — activa la versión (o vuelve a una anterior) y recalcula los puntajes */
export const POST = manejar(["ADMIN"], async ({ req, params, session }) => {
  const { id } = idSchema.parse(params);
  const { recalcular } = await leerJson(req, activarModeloSchema);
  return new ServicioModelo().activar(id, { usuarioId: session.user.id, rol: session.user.rol }, recalcular);
});
