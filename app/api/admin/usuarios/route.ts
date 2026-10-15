import { manejar, leerJson, leerQuery } from "@/lib/api";
import { crearUsuarioSchema, filtrosUsuariosSchema } from "@/lib/validators/admin";
import { ServicioUsuarios } from "@/services/admin/ServicioUsuarios";

export const dynamic = "force-dynamic";

/** GET /api/admin/usuarios?rol=&estado=&busqueda=&pagina= (ADMIN) */
export const GET = manejar(["ADMIN"], async ({ req }) => new ServicioUsuarios().listar(leerQuery(req, filtrosUsuariosSchema)));

/** POST /api/admin/usuarios — crea una cuenta con contraseña temporal (ADMIN) */
export const POST = manejar(["ADMIN"], async ({ req, session }) => {
  const datos = await leerJson(req, crearUsuarioSchema);
  return new ServicioUsuarios().crear(datos, { usuarioId: session.user.id, rol: session.user.rol });
});
