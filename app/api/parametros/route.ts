import { manejar, leerJson } from "@/lib/api";
import { actualizarParametrosSchema } from "@/lib/validators/parametros";
import { ServicioParametros } from "@/services/parametros/ServicioParametros";

export const dynamic = "force-dynamic";

/** GET /api/parametros — lista todos los parámetros (solo ADMIN) */
export const GET = manejar(["ADMIN"], async () => {
  return { parametros: await new ServicioParametros().listar() };
});

/** PUT /api/parametros — actualiza uno o varios valores (solo ADMIN) */
export const PUT = manejar(["ADMIN"], async ({ req, session }) => {
  const cuerpo = await leerJson(req, actualizarParametrosSchema);
  return new ServicioParametros().actualizar(cuerpo, session.user.id);
});
