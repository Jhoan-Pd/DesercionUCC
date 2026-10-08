import { manejar, leerJson } from "@/lib/api";
import { cambiarEstadoAlertaSchema } from "@/lib/validators/alertas";
import { idSchema } from "@/lib/validators/riesgo";
import { ServicioAlertas } from "@/services/alertas/ServicioAlertas";

export const dynamic = "force-dynamic";

/** PATCH /api/alertas/:id — Bienestar cambia el estado (abierta, en seguimiento, cerrada) */
export const PATCH = manejar(["BIENESTAR", "ADMIN"], async ({ req, params }) => {
  const { id } = idSchema.parse(params);
  const { estado } = await leerJson(req, cambiarEstadoAlertaSchema);
  return new ServicioAlertas().cambiarEstado(id, estado);
});
