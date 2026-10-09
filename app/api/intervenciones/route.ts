import { manejar, leerJson, leerQuery } from "@/lib/api";
import { crearIntervencionSchema, listaIntervencionesSchema } from "@/lib/validators/intervenciones";
import { ServicioIntervenciones } from "@/services/intervenciones/ServicioIntervenciones";

export const dynamic = "force-dynamic";

/** GET /api/intervenciones?estado=&tipo=&busqueda=&pagina= — lista paginada (ADMIN, BIENESTAR) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ req }) => {
  return new ServicioIntervenciones().listar(leerQuery(req, listaIntervencionesSchema));
});

/** POST /api/intervenciones — registra una intervención en el periodo actual */
export const POST = manejar(["ADMIN", "BIENESTAR"], async ({ req, session }) => {
  const datos = await leerJson(req, crearIntervencionSchema);
  return new ServicioIntervenciones().crear(datos, { usuarioId: session.user.id, rol: session.user.rol });
});
