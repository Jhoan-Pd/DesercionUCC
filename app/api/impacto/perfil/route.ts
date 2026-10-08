import { manejar, leerQuery } from "@/lib/api";
import { perfilImpactoQuerySchema } from "@/lib/validators/impacto";
import { ServicioImpacto } from "@/services/impacto/ServicioImpacto";

export const dynamic = "force-dynamic";

/**
 * GET /api/impacto/perfil
 *  - ESTUDIANTE: devuelve SU perfil (ignora cualquier código enviado).
 *  - ADMIN/BIENESTAR con ?codigo=UCC...: perfil de ese estudiante (acceso auditado).
 *  - Cualquiera con ?programaId=: valores por defecto del programa (sin datos personales).
 */
export const GET = manejar(null, async ({ req, session }) => {
  const q = leerQuery(req, perfilImpactoQuerySchema);
  const servicio = new ServicioImpacto();
  const { rol, estudianteId, id } = session.user;

  if (rol === "ESTUDIANTE") {
    if (estudianteId && !q.programaId) return servicio.perfilPorEstudiante({ estudianteId }, { rol, estudianteId, usuarioId: id });
    return servicio.perfilPorPrograma(q.programaId);
  }
  if (q.codigo) {
    if (rol !== "ADMIN" && rol !== "BIENESTAR") return servicio.perfilPorPrograma(q.programaId);
    return servicio.perfilPorEstudiante({ codigo: q.codigo }, { rol, estudianteId, usuarioId: id });
  }
  return servicio.perfilPorPrograma(q.programaId);
});
