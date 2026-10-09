import { manejar, leerJson } from "@/lib/api";
import { idSchema } from "@/lib/validators/riesgo";
import { actualizarIntervencionSchema } from "@/lib/validators/intervenciones";
import { ServicioIntervenciones } from "@/services/intervenciones/ServicioIntervenciones";

export const dynamic = "force-dynamic";

/** PATCH /api/intervenciones/:id — cambia el estado y registra el resultado */
export const PATCH = manejar(["ADMIN", "BIENESTAR"], async ({ req, session, params }) => {
  const { id } = idSchema.parse(params);
  const datos = await leerJson(req, actualizarIntervencionSchema);
  return new ServicioIntervenciones().actualizar(id, datos, { usuarioId: session.user.id, rol: session.user.rol });
});
