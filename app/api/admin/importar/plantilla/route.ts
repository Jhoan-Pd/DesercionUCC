import { manejar } from "@/lib/api";
import { ServicioImportacion } from "@/services/importacion/ServicioImportacion";

export const dynamic = "force-dynamic";

/** GET /api/admin/importar/plantilla — CSV de ejemplo con el formato esperado (ADMIN) */
export const GET = manejar(["ADMIN"], async () => {
  const csv = await new ServicioImportacion().plantilla();
  // El BOM hace que Excel reconozca el archivo como UTF-8 y muestre bien las tildes
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-importacion-estudiantes.csv"',
      "Cache-Control": "no-store",
    },
  });
});
