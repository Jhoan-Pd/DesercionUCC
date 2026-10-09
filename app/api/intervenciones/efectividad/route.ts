import { manejar } from "@/lib/api";
import { ServicioIntervenciones } from "@/services/intervenciones/ServicioIntervenciones";

export const dynamic = "force-dynamic";

/** GET /api/intervenciones/efectividad — permanencia de intervenidos vs. no intervenidos ajustada por riesgo */
export const GET = manejar(["ADMIN", "BIENESTAR"], async () => new ServicioIntervenciones().efectividad());
