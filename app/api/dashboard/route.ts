import { manejar, leerQuery } from "@/lib/api";
import { filtrosDashboardSchema } from "@/lib/validators/dashboard";
import { ServicioDashboard } from "@/services/dashboard/ServicioDashboard";

export const dynamic = "force-dynamic";

/** GET /api/dashboard?programaId=&cohorteAnio=&estrato=&financiacion=&sexo=&trabaja=  (ADMIN, BIENESTAR) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ req }) => {
  const filtros = leerQuery(req, filtrosDashboardSchema);
  return new ServicioDashboard().obtenerResumen(filtros);
});
