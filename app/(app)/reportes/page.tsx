import { getServerSession } from "next-auth";
import { ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PanelReportes } from "@/components/reportes/PanelReportes";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

const NOMBRE_REPORTE: Record<string, string> = {
  "reporte:institucional": "Institucional",
  "reporte:riesgo": "Lista de riesgo",
  "reporte:intervenciones": "Intervenciones",
  "reporte:impacto-institucional": "Impacto institucional",
};

export default async function ReportesPage() {
  const session = (await getServerSession(authOptions))!;
  const [programas, exportaciones] = await Promise.all([
    prisma.programa.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    // Solo las exportaciones propias: cada usuario ve su rastro (el ADMIN ve todo en Auditoría)
    prisma.auditoriaAcceso.findMany({
      where: { accion: "EXPORTACION", usuarioId: session.user.id },
      orderBy: { creadoEn: "desc" },
      take: 8,
      select: { id: true, recurso: true, detalle: true, creadoEn: true },
    }),
  ]);
  const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="max-w-3xl text-muted-foreground">
          Descarga los resultados del observatorio en PDF (para presentar) o en Excel (para seguir analizando). Los datos individuales salen anonimizados.
        </p>
      </header>

      <PanelReportes programas={programas} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ucc-verde" aria-hidden />
            <div className="space-y-1">
              <CardTitle>Protección de datos</CardTitle>
              <CardDescription>Ley 1581 de 2012 (habeas data)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Los reportes no incluyen nombres, documentos, correos ni códigos institucionales. Cada estudiante aparece con un código anónimo que solo el sistema puede relacionar con su ficha.</p>
            <p>Comparte los archivos únicamente con personal autorizado y para fines de permanencia estudiantil.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tus exportaciones recientes</CardTitle>
            <CardDescription>Registro de auditoría de los reportes que descargaste.</CardDescription>
          </CardHeader>
          <CardContent>
            {exportaciones.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Todavía no has descargado reportes.</p>
            ) : (
              <Table>
                <THead>
                  <TR><TH>Fecha</TH><TH>Reporte</TH><TH>Detalle</TH></TR>
                </THead>
                <TBody>
                  {exportaciones.map((e) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap">{fecha.format(e.creadoEn)}</TD>
                      <TD>{NOMBRE_REPORTE[e.recurso] ?? e.recurso}</TD>
                      <TD className="text-xs text-muted-foreground">{e.detalle}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
