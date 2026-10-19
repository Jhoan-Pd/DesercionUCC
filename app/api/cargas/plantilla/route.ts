import { manejar } from "@/lib/api";
import { plantillaExcel } from "@/services/carga/excel";
import { ENCABEZADOS_PLANTILLA } from "@/services/carga/lector";

/** Plantilla vacía para cargar estudiantes: ?formato=csv o Excel (por defecto) */
export const GET = manejar(["ADMIN"], async ({ req }) => {
  const formato = new URL(req.url).searchParams.get("formato");
  if (formato === "csv") {
    // Punto y coma: así lo abre Excel con la configuración regional de Colombia
    return new Response(`﻿${ENCABEZADOS_PLANTILLA.join(";")}\r\n`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="plantilla-estudiantes.csv"' },
    });
  }
  return new Response(new Uint8Array(await plantillaExcel()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-estudiantes.xlsx"',
    },
  });
});
