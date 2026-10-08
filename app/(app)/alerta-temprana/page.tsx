import Link from "next/link";
import { AlertOctagon, AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { listaRiesgoSchema } from "@/lib/validators/riesgo";
import { ServicioRiesgo } from "@/services/riesgo/ServicioRiesgo";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { NivelBadge } from "@/components/riesgo/NivelBadge";
import { BarraPuntaje } from "@/components/riesgo/BarraPuntaje";
import { FiltrosRiesgo } from "@/components/riesgo/FiltrosRiesgo";
import { BotonRecalcular } from "@/components/riesgo/BotonRecalcular";
import { Paginacion } from "@/components/riesgo/Paginacion";

export const metadata = { title: "Alerta temprana" };
export const dynamic = "force-dynamic";

function Indicador({ titulo, valor, detalle, icono, clase }: { titulo: string; valor: number; detalle: string; icono: React.ReactNode; clase: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <p className="text-3xl font-bold tabular-nums">{valor.toLocaleString("es-CO")}</p>
          <p className="text-xs text-muted-foreground">{detalle}</p>
        </div>
        <span className={`rounded-lg p-2 ${clase}`}>{icono}</span>
      </CardContent>
    </Card>
  );
}

export default async function AlertaTempranaPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const plano: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v !== "") plano[k] = v;
  const analisis = listaRiesgoSchema.safeParse(plano);
  const filtros = analisis.success ? analisis.data : listaRiesgoSchema.parse({});
  const lista = await new ServicioRiesgo().listaPriorizada(filtros);
  const { resumen } = lista;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Alerta temprana</h1>
          <p className="max-w-3xl text-muted-foreground">
            Estudiantes activos y aplazados ordenados por su probabilidad estimada de desertar en el próximo año académico (periodo {lista.periodo ?? "—"}).
          </p>
        </div>
        <BotonRecalcular />
      </header>

      {!analisis.success && <Alert variant="warning">Algún filtro de la URL no era válido y se ignoró.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Riesgo alto" valor={resumen.ALTO} detalle="Prioridad de contacto" icono={<AlertOctagon className="h-5 w-5" aria-hidden />} clase="bg-red-100 text-red-700" />
        <Indicador titulo="Riesgo medio" valor={resumen.MEDIO} detalle="Seguimiento preventivo" icono={<AlertTriangle className="h-5 w-5" aria-hidden />} clase="bg-amber-100 text-amber-800" />
        <Indicador titulo="Riesgo bajo" valor={resumen.BAJO} detalle="Sin acción inmediata" icono={<CheckCircle2 className="h-5 w-5" aria-hidden />} clase="bg-green-100 text-green-800" />
        <Indicador titulo="Alertas abiertas" valor={resumen.alertasAbiertas} detalle="Modelo, docentes y encuestas" icono={<Bell className="h-5 w-5" aria-hidden />} clase="bg-secondary text-primary" />
      </div>

      <FiltrosRiesgo programas={lista.programas} />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          {lista.filas.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Ningún estudiante cumple estos filtros.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Puntaje</TH>
                  <TH>Nivel</TH>
                  <TH>Estudiante</TH>
                  <TH>Programa</TH>
                  <TH>Sem.</TH>
                  <TH>Principales factores</TH>
                  <TH>Alertas</TH>
                  <TH><span className="sr-only">Acciones</span></TH>
                </TR>
              </THead>
              <TBody>
                {lista.filas.map((f) => (
                  <TR key={f.estudianteId}>
                    <TD><BarraPuntaje puntaje={f.puntaje} nivel={f.nivel} /></TD>
                    <TD><NivelBadge nivel={f.nivel} /></TD>
                    <TD>
                      <p className="font-medium">{f.nombre}</p>
                      <p className="text-xs text-muted-foreground">{f.codigo}{f.estado === "APLAZADO" ? " · aplazado" : ""}</p>
                    </TD>
                    <TD className="text-sm">{f.programa}</TD>
                    <TD className="tabular-nums">{f.semestre}</TD>
                    <TD className="max-w-xs text-xs text-muted-foreground">{f.principales.length ? f.principales.join(" · ") : "—"}</TD>
                    <TD>{f.alertasAbiertas > 0 ? <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700"><Bell className="h-3.5 w-3.5" aria-hidden />{f.alertasAbiertas}</span> : <span className="text-muted-foreground">—</span>}</TD>
                    <TD><Link href={`/alerta-temprana/${f.estudianteId}`} className="text-sm font-medium text-primary underline-offset-2 hover:underline">Ver ficha</Link></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <Paginacion pagina={lista.pagina} paginas={lista.paginas} total={lista.total} base="/alerta-temprana" params={plano} />
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Modelo {lista.modelo.version} ({lista.modelo.origen === "PYTHON_SKLEARN" ? "entrenado en Python con scikit-learn" : "reentrenado desde el panel"}). El puntaje es una estimación para priorizar el acompañamiento, no un diagnóstico. Información confidencial (Ley 1581 de 2012).
        {lista.modelo.calculadoEn && ` Último cálculo: ${new Date(lista.modelo.calculadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}.`}
      </p>
    </div>
  );
}
