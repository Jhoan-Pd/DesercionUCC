import { manejar, leerJson } from "@/lib/api";
import { programaParcialSchema } from "@/lib/validators/admin";
import { idSchema } from "@/lib/validators/riesgo";
import { ServicioCatalogos } from "@/services/admin/ServicioCatalogos";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/programas/:id — actualiza campos, salario de enganche o lo activa/desactiva (ADMIN) */
export const PATCH = manejar(["ADMIN"], async ({ req, params, session }) => {
  const { id } = idSchema.parse(params);
  const cambios = await leerJson(req, programaParcialSchema);
  return new ServicioCatalogos().actualizarPrograma(id, cambios, { usuarioId: session.user.id, rol: session.user.rol });
});

/** DELETE /api/admin/programas/:id — solo si no tiene estudiantes (si los tiene, se desactiva) */
export const DELETE = manejar(["ADMIN"], async ({ params, session }) => {
  const { id } = idSchema.parse(params);
  return new ServicioCatalogos().eliminarPrograma(id, { usuarioId: session.user.id, rol: session.user.rol });
});
