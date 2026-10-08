import { z } from "zod";
import { manejar, leerQuery } from "@/lib/api";
import { ServicioDocente } from "@/services/docente/ServicioDocente";

export const dynamic = "force-dynamic";

const querySchema = z.object({ docenteId: z.string().uuid("Docente inválido").optional() });

/** GET /api/docente/cursos — cursos del docente con señales académicas (ADMIN puede elegir docente) */
export const GET = manejar(["DOCENTE", "ADMIN"], async ({ req, session }) => {
  const { docenteId } = leerQuery(req, querySchema);
  return new ServicioDocente().cursos({ id: session.user.id, rol: session.user.rol }, docenteId);
});
