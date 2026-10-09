import { manejar, leerQuery } from "@/lib/api";
import { filtrosInstitucionalSchema } from "@/lib/validators/institucional";
import { ServicioImpactoInstitucional } from "@/services/institucional/ServicioImpactoInstitucional";

export const dynamic = "force-dynamic";

/** GET /api/impacto-institucional?programaId= — impacto institucional, académico y regional (ADMIN, BIENESTAR) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ req }) => {
  return new ServicioImpactoInstitucional().obtener(leerQuery(req, filtrosInstitucionalSchema));
});
