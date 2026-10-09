import { manejar, leerJson } from "@/lib/api";
import { programaSchema } from "@/lib/validators/admin";
import { ServicioCatalogos } from "@/services/admin/ServicioCatalogos";

export const dynamic = "force-dynamic";

/** GET /api/admin/programas — lista con estudiantes y salario de enganche (ADMIN) */
export const GET = manejar(["ADMIN"], async () => ({ programas: await new ServicioCatalogos().listarProgramas() }));

/** POST /api/admin/programas — crea un programa (ADMIN) */
export const POST = manejar(["ADMIN"], async ({ req, session }) => {
  const datos = await leerJson(req, programaSchema);
  return new ServicioCatalogos().crearPrograma(datos, { usuarioId: session.user.id, rol: session.user.rol });
});
