import { manejar, leerJson } from "@/lib/api";
import { actualizarUsuarioSchema } from "@/lib/validators/admin";
import { idSchema } from "@/lib/validators/riesgo";
import { ServicioUsuarios } from "@/services/admin/ServicioUsuarios";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/usuarios/:id — nombre, rol, activo, enlace con estudiante, contraseña o desbloqueo (ADMIN) */
export const PATCH = manejar(["ADMIN"], async ({ req, params, session }) => {
  const { id } = idSchema.parse(params);
  const cambios = await leerJson(req, actualizarUsuarioSchema);
  return new ServicioUsuarios().actualizar(id, cambios, { usuarioId: session.user.id, rol: session.user.rol });
});
