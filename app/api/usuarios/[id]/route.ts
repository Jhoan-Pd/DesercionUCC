import { manejar, leerJson } from "@/lib/api";
import { actualizarUsuarioSchema } from "@/lib/validators/usuarios";
import { ServicioUsuarios } from "@/services/usuarios/ServicioUsuarios";

/** Cambia nombre, rol, estado o contraseña de una cuenta, o la desbloquea */
export const PATCH = manejar(["ADMIN"], async ({ req, params, session }) =>
  new ServicioUsuarios().actualizar(params.id, await leerJson(req, actualizarUsuarioSchema), session.user.id),
);
