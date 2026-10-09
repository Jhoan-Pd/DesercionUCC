import { manejar, leerQuery } from "@/lib/api";
import { opcionesReporteSchema, tipoReporteSchema } from "@/lib/validators/reportes";
import { ServicioReportes } from "@/services/reportes/ServicioReportes";

export const dynamic = "force-dynamic";
// jsPDF y ExcelJS necesitan el runtime de Node (no Edge)
export const runtime = "nodejs";

/**
 * GET /api/reportes/:tipo?formato=pdf|xlsx&programaId=
 * tipo: institucional | riesgo | intervenciones | impacto-institucional  (ADMIN y BIENESTAR)
 * Devuelve el archivo para descargar; la exportación queda registrada en la auditoría.
 */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ req, params, session }) => {
  const { tipo } = tipoReporteSchema.parse(params);
  const opciones = leerQuery(req, opcionesReporteSchema);
  const archivo = await new ServicioReportes().exportar(tipo, opciones, { usuarioId: session.user.id, rol: session.user.rol });
  return new Response(new Uint8Array(archivo.contenido), {
    headers: {
      "Content-Type": archivo.tipoMime,
      "Content-Disposition": `attachment; filename="${archivo.nombre}"`,
      "Cache-Control": "no-store",
    },
  });
});
