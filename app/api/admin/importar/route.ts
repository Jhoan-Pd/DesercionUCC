import { manejar, leerJson } from "@/lib/api";
import { importarCsvSchema } from "@/lib/validators/importacion";
import { ServicioImportacion } from "@/services/importacion/ServicioImportacion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Importar miles de filas puede tardar más que el límite por defecto de una función en Vercel
export const maxDuration = 60;

/** GET /api/admin/importar — columnas esperadas e historial de importaciones (ADMIN) */
export const GET = manejar(["ADMIN"], async () => {
  const servicio = new ServicioImportacion();
  return { columnas: ServicioImportacion.columnas(), historial: await servicio.historial() };
});

/**
 * POST /api/admin/importar  { archivo, contenido, confirmar }
 *  - confirmar=false: valida y devuelve la vista previa (no escribe nada).
 *  - confirmar=true: vuelve a validar y, si no hay errores, importa todo en una transacción.
 */
export const POST = manejar(["ADMIN"], async ({ req, session }) => {
  const { archivo, contenido, confirmar } = await leerJson(req, importarCsvSchema);
  const servicio = new ServicioImportacion();
  if (!confirmar) return servicio.vistaPrevia(contenido);
  return servicio.importar(archivo, contenido, { usuarioId: session.user.id, rol: session.user.rol });
});
