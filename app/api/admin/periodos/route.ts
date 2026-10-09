import { manejar, leerJson } from "@/lib/api";
import { periodoSchema } from "@/lib/validators/admin";
import { ServicioCatalogos } from "@/services/admin/ServicioCatalogos";

export const dynamic = "force-dynamic";

/** GET /api/admin/periodos — periodos del más reciente al más antiguo (ADMIN) */
export const GET = manejar(["ADMIN"], async () => ({ periodos: await new ServicioCatalogos().listarPeriodos() }));

/** POST /api/admin/periodos — crea un periodo y opcionalmente lo activa (ADMIN) */
export const POST = manejar(["ADMIN"], async ({ req, session }) => {
  const datos = await leerJson(req, periodoSchema);
  return new ServicioCatalogos().crearPeriodo(datos, { usuarioId: session.user.id, rol: session.user.rol });
});
