import { manejar } from "@/lib/api";
import { ServicioRiesgo } from "@/services/riesgo/ServicioRiesgo";

export const dynamic = "force-dynamic";

/** POST /api/riesgo/recalcular — aplica el modelo activo a los estudiantes activos y aplazados */
export const POST = manejar(["ADMIN", "BIENESTAR"], async () => new ServicioRiesgo().recalcularPuntajes());
