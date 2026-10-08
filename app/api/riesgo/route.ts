import { manejar, leerQuery } from "@/lib/api";
import { listaRiesgoSchema } from "@/lib/validators/riesgo";
import { ServicioRiesgo } from "@/services/riesgo/ServicioRiesgo";

export const dynamic = "force-dynamic";

/** GET /api/riesgo?nivel=&programaId=&busqueda=&conAlerta=&pagina= — lista priorizada (ADMIN, BIENESTAR) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ req }) => new ServicioRiesgo().listaPriorizada(leerQuery(req, listaRiesgoSchema)));
