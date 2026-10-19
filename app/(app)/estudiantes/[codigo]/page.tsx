import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot } from "lucide-react";
import { ServicioEstudiantes } from "@/services/estudiantes/ServicioEstudiantes";
import { VARIABLES, tieneValor } from "@/services/riesgo/variables";
import { Encabezado } from "@/components/comunes/Encabezado";
import { NivelBadge } from "@/components/estudiantes/NivelBadge";
import { BarraPuntaje } from "@/components/estudiantes/BarraPuntaje";
import { ExplicacionAgente } from "@/components/estudiantes/ExplicacionAgente";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Ficha del estudiante" };
export const dynamic = "force-dynamic";

const ESTADO: Record<string, string> = { ACTIVO: "Activo", RETIRADO: "Retirado", GRADUADO: "Graduado" };

export default async function FichaPage({ params }: { params: { codigo: string } }) {
  const e = await new ServicioEstudiantes().detalle(decodeURIComponent(params.codigo));
  if (!e) notFound();
  const ev = e.evaluacion;

  return (
    <>
      <Link href="/estudiantes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a la lista
      </Link>
      <Encabezado
        titulo={e.nombre}
        descripcion={
          <>
            Código {e.codigo} · {e.programa} · semestre {e.datos.semestre}
            {e.periodo ? ` · periodo ${e.periodo}` : ""} · {ESTADO[e.estado]}
          </>
        }
      >
        {ev && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2">
            <NivelBadge nivel={ev.nivel} />
            <BarraPuntaje puntaje={ev.puntaje} nivel={ev.nivel} />
          </div>
        )}
      </Encabezado>

      {!ev && (
        <Alert variant="info" titulo="Sin evaluación de riesgo">
          Solo se evalúan los estudiantes activos. Este estudiante figura como {ESTADO[e.estado].toLowerCase()} y su información sirve para entrenar el modelo.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {ev && (
            <Card>
              <CardHeader>
                <CardTitle>¿Por qué este nivel de riesgo?</CardTitle>
                <CardDescription>
                  {ev.metodo === "MODELO"
                    ? `Modelo entrenado con estudiantes de la UCC (${ev.modeloVersion}). Los puntos reparten el riesgo que tiene por encima de un estudiante promedio según lo que pesa cada dato.`
                    : "Puntaje por factores de riesgo (0 a 100). Cada factor suma los puntos indicados."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ev.factores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Con los datos disponibles no aparece ningún factor de alerta.</p>
                ) : (
                  <ul className="divide-y">
                    {ev.factores.map((f) => (
                      <li key={f.clave} className="flex items-start justify-between gap-4 py-3">
                        <div>
                          <p className="font-medium">{f.etiqueta}</p>
                          <p className="text-sm text-muted-foreground">{f.detalle}</p>
                          {f.fuente && <p className="mt-0.5 text-xs text-muted-foreground/80">Fuente: {f.fuente}</p>}
                        </div>
                        <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-sm font-semibold tabular-nums">+{f.puntos}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {ev.faltantes.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No se pudieron evaluar por falta de datos: {ev.faltantes.map((c) => VARIABLES.find((v) => v.clave === c)?.etiqueta.toLowerCase() ?? c).join(", ")}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {ev && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-4 w-4" aria-hidden /> Explicación del agente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExplicacionAgente codigo={e.codigo} inicial={ev.explicacion ? { explicacion: ev.explicacion, modeloIa: ev.modeloIa, explicadaEn: ev.explicadaEn } : null} />
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Datos del estudiante</CardTitle>
            <CardDescription>
              {e.cargadoDe ? `Del archivo «${e.cargadoDe.archivo}» (${new Date(e.cargadoDe.fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })})` : "Cargado por el administrador"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {VARIABLES.map((v) => {
                const valor = e.datos[v.clave];
                return (
                  <div key={v.clave} className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">{v.etiqueta}</dt>
                    <dd className={tieneValor(valor) ? "font-medium tabular-nums" : "italic text-muted-foreground"}>{tieneValor(valor) ? v.formato(valor) : "Sin dato"}</dd>
                  </div>
                );
              })}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
