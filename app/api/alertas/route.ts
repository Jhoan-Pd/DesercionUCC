import { manejar, leerJson } from "@/lib/api";
import { crearAlertaSchema } from "@/lib/validators/alertas";
import { ServicioAlertas } from "@/services/alertas/ServicioAlertas";

export const dynamic = "force-dynamic";

/** POST /api/alertas — un docente (desde su curso) o Bienestar reporta una alerta */
export const POST = manejar(["DOCENTE", "BIENESTAR", "ADMIN"], async ({ req, session }) => {
  const datos = await leerJson(req, crearAlertaSchema);
  return new ServicioAlertas().crear(datos, { id: session.user.id, rol: session.user.rol });
});
