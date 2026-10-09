import { manejar, leerJson } from "@/lib/api";
import { cambiosPeriodoSchema } from "@/lib/validators/admin";
import { idSchema } from "@/lib/validators/riesgo";
import { ServicioCatalogos } from "@/services/admin/ServicioCatalogos";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/periodos/:id — cambia fechas o lo activa como periodo actual (ADMIN) */
export const PATCH = manejar(["ADMIN"], async ({ req, params, session }) => {
  const { id } = idSchema.parse(params);
  const cambios = await leerJson(req, cambiosPeriodoSchema);
  return new ServicioCatalogos().actualizarPeriodo(id, cambios, { usuarioId: session.user.id, rol: session.user.rol });
});

/** DELETE /api/admin/periodos/:id — solo periodos sin información académica y que no estén activos */
export const DELETE = manejar(["ADMIN"], async ({ params, session }) => {
  const { id } = idSchema.parse(params);
  return new ServicioCatalogos().eliminarPeriodo(id, { usuarioId: session.user.id, rol: session.user.rol });
});
