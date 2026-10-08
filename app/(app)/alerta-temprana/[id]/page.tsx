import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, Calculator } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { ErrorApi } from "@/lib/api";
import { idSchema } from "@/lib/validators/riesgo";
import { ServicioRiesgo, type DetalleRiesgo } from "@/services/riesgo/ServicioRiesgo";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { NivelBadge } from "@/components/riesgo/NivelBadge";
import { GraficaFactores } from "@/components/riesgo/GraficaFactores";
import { GraficaHistorial } from "@/components/riesgo/GraficaHistorial";
import { GestorAlertas } from "@/components/riesgo/GestorAlertas";
import { BarrasDimension } from "@/components/encuesta/BarrasDimension";
import { formatoCOP } from "@/lib/utils";

export const metadata = { title: "Ficha de riesgo" };
export const dynamic = "force-dynamic";

const FINANCIACION: Record<string, string> = { RECURSOS_PROPIOS: "Recursos propios", ICETEX: "ICETEX", BECA: "Beca", CREDITO_UCC: "Crédito UCC" };
const INTERVENCION: Record<string, string> = { TUTORIA: "Tutoría", APOYO_ECONOMICO: "Apoyo económico", ACOMPANAMIENTO_PSICOLOGICO: "Acompañamiento psicológico", ORIENTACION_VOCACIONAL: "Orientación vocacional", OTRO: "Otra" };

export default async function FichaRiesgoPage({ params }: { params: { id: string } }) {
  const valido = idSchema.safeParse(params);
  if (!valido.success) notFound();
  const session = (await getServerSession(authOptions))!;
  let d: DetalleRiesgo;
  try {
    d = await new ServicioRiesgo().detalle(valido.data.id, { usuarioId: session.user.id, rol: session.user.rol });
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 404) notFound();
    throw e;
  }
  const { estudiante: e, puntaje: p } = d;
  const encuesta = d.encuestas[0];

  return (
    <div className="space-y-6">
      <Link href="/alerta-temprana" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a la lista
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-6 p-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{e.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {e.codigo} · {e.programa} · semestre {e.semestreActual} de {e.duracionSemestres} · cohorte {e.cohorte} · {e.estado.toLowerCase()}
            </p>
            <p className="text-sm text-muted-foreground">
              Estrato {e.estrato} · {e.municipio} · {e.trabaja ? `trabaja ${e.horasTrabajoSemana} h/semana` : "no trabaja"} ·{" "}
              {e.financiaciones.map((f) => `${FINANCIACION[f.tipo]} ${f.porcentajeCubierto}%${f.saldoPendiente > 0 ? ` (saldo ${formatoCOP(f.saldoPendiente)})` : ""}`).join(", ")}
            </p>
            <Link href={`/calculadora?codigo=${encodeURIComponent(e.codigo)}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Calculator className="h-4 w-4" aria-hidden /> Simular el impacto de retirarse con este estudiante
            </Link>
          </div>
          {p ? (
            <div className="min-w-[220px] rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Puntaje de riesgo ({p.periodo})</p>
              <p className="text-5xl font-bold tabular-nums">{p.puntaje}</p>
              <NivelBadge nivel={p.nivel} className="mt-1" />
              <p className="mt-2 text-xs text-muted-foreground">
                {p.puntaje}% de probabilidad estimada de desertar en el próximo año. Estudiante promedio: {p.probabilidadPromedio}%. Medio desde {p.umbrales.medio}, alto desde {p.umbrales.alto}.
              </p>
            </div>
          ) : (
            <Alert variant="info">Sin puntaje en el periodo actual (solo se calculan para estudiantes activos o aplazados).</Alert>
          )}
        </CardContent>
      </Card>

      {d.retiro && (
        <Alert variant="warning" titulo="Estudiante retirado">
          Se retiró en el semestre {d.retiro.semestre}. Causa registrada: {d.retiro.causa}.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {p && <GraficaFactores factores={p.factores} />}
        <GraficaHistorial notas={d.notas} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GestorAlertas estudianteId={e.id} alertas={d.alertas} />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cursos del periodo</CardTitle>
              <CardDescription>Notas parciales y asistencia reportadas por los docentes.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.cursos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tiene cursos inscritos en el periodo actual.</p>
              ) : (
                <Table>
                  <THead><TR><TH>Curso</TH><TH>Nota</TH><TH>Asistencia</TH><TH>Fallas</TH></TR></THead>
                  <TBody>
                    {d.cursos.map((c) => (
                      <TR key={c.codigo}>
                        <TD><p className="font-medium">{c.nombre}</p><p className="text-xs text-muted-foreground">{c.codigo} · {c.docente}</p></TD>
                        <TD className={c.notaParcial !== null && c.notaParcial < 3 ? "font-semibold text-red-700" : undefined}>{c.notaParcial === null ? "—" : c.notaParcial.toLocaleString("es-CO")}</TD>
                        <TD className={c.asistenciaPct < 80 ? "font-semibold text-red-700" : undefined}>{c.asistenciaPct.toLocaleString("es-CO")}%</TD>
                        <TD>{c.fallas}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Encuesta de autoevaluación</CardTitle>
              <CardDescription>{encuesta ? `Última respuesta: ${new Date(encuesta.fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}` : "El estudiante no ha respondido la encuesta."}</CardDescription>
            </CardHeader>
            {encuesta && (
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums">{encuesta.puntaje}/100</span>
                  {encuesta.nivel && <NivelBadge nivel={encuesta.nivel} />}
                  <span className="text-xs text-muted-foreground">{encuesta.autorizaContacto ? "Autorizó ser contactado" : "No autorizó contacto"}</span>
                </div>
                <BarrasDimension puntajes={(encuesta.puntajesDimension ?? {}) as Record<string, number>} />
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intervenciones</CardTitle>
              <CardDescription>Acciones de acompañamiento registradas por Bienestar.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.intervenciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin intervenciones registradas.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.intervenciones.map((i) => (
                    <li key={i.id} className="rounded-md border p-3">
                      <p className="font-medium">{INTERVENCION[i.tipo] ?? i.tipo} · {new Date(i.fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })} · {i.estado.toLowerCase().replace("_", " ")}</p>
                      <p className="text-muted-foreground">{i.descripcion}</p>
                      <p className="text-xs text-muted-foreground">Responsable: {i.responsable}{i.montoApoyo ? ` · ${formatoCOP(i.montoApoyo)}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Información confidencial. Esta consulta quedó registrada (Ley 1581 de 2012).</p>
    </div>
  );
}
