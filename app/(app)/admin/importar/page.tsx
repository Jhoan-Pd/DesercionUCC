import { Download } from "lucide-react";
import { ServicioImportacion } from "@/services/importacion/ServicioImportacion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ImportadorArchivo } from "@/components/admin/ImportadorArchivo";
import { MigaAdmin } from "@/components/admin/MigaAdmin";

export const metadata = { title: "Importar estudiantes" };
export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const historial = await new ServicioImportacion().historial();
  const columnas = ServicioImportacion.columnas();
  const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <MigaAdmin actual="Importar CSV" />
        <h1 className="text-2xl font-bold tracking-tight">Importar estudiantes desde CSV</h1>
        <p className="max-w-3xl text-muted-foreground">
          Carga datos reales de Registro Académico: una fila por estudiante y semestre cursado. Si un estudiante ya existe (mismo código), su trayectoria se reemplaza con la del archivo.
        </p>
      </header>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>1. Prepara el archivo</CardTitle>
            <CardDescription>Descarga la plantilla, reemplaza las filas de ejemplo y guárdala como CSV.</CardDescription>
          </div>
          <a
            href="/api/admin/importar/plantilla"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-secondary"
          >
            <Download className="h-4 w-4" aria-hidden /> Descargar plantilla
          </a>
        </CardHeader>
        <CardContent>
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-primary">Ver las {columnas.length} columnas y sus reglas</summary>
            <div className="mt-3">
              <Table>
                <THead><TR><TH>Columna</TH><TH>Obligatoria</TH><TH>Descripción</TH><TH>Ejemplo</TH></TR></THead>
                <TBody>
                  {columnas.map((c) => (
                    <TR key={c.clave}>
                      <TD><code className="text-xs">{c.clave}</code></TD>
                      <TD>{c.requerida ? <Badge>Sí</Badge> : <Badge variant="muted">No</Badge>}</TD>
                      <TD className="text-sm">{c.descripcion}</TD>
                      <TD className="text-xs text-muted-foreground">{c.ejemplo || "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </details>
        </CardContent>
      </Card>

      <ImportadorArchivo />

      <Card>
        <CardHeader>
          <CardTitle>Historial de importaciones</CardTitle>
          <CardDescription>Cada importación queda además en la auditoría de accesos.</CardDescription>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aún no se han hecho importaciones.</p>
          ) : (
            <Table>
              <THead><TR><TH>Fecha</TH><TH>Archivo</TH><TH>Filas</TH><TH>Nuevos</TH><TH>Actualizados</TH><TH>Semestres</TH><TH>Usuario</TH></TR></THead>
              <TBody>
                {historial.map((h) => (
                  <TR key={h.id}>
                    <TD className="whitespace-nowrap">{fecha.format(new Date(h.creadaEn))}</TD>
                    <TD className="max-w-[220px] truncate">{h.archivo}</TD>
                    <TD className="tabular-nums">{h.filas.toLocaleString("es-CO")}</TD>
                    <TD className="tabular-nums">{h.estudiantesNuevos.toLocaleString("es-CO")}</TD>
                    <TD className="tabular-nums">{h.estudiantesActualizados.toLocaleString("es-CO")}</TD>
                    <TD className="tabular-nums">{h.semestres.toLocaleString("es-CO")}</TD>
                    <TD>{h.usuario}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
