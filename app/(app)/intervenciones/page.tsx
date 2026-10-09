import { Suspense } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { listaIntervencionesSchema } from "@/lib/validators/intervenciones";
import { ServicioIntervenciones } from "@/services/intervenciones/ServicioIntervenciones";
import { ESTADO_ESTUDIANTE, ESTADO_INTERVENCION, TIPO_INTERVENCION } from "@/lib/etiquetas";
import { formatoCOP, formatoCOPCompacto } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Paginacion } from "@/components/riesgo/Paginacion";
import { RegistrarIntervencion } from "@/components/intervenciones/RegistrarIntervencion";
import { CerrarIntervencion } from "@/components/intervenciones/CerrarIntervencion";
import { FiltrosIntervenciones } from "@/components/intervenciones/FiltrosIntervenciones";
import { EfectoForest } from "@/components/intervenciones/EfectoForest";
import { GraficaCobertura, GraficaEstratos } from "@/components/intervenciones/GraficasEfectividad";

export const metadata = { title: "Intervenciones" };
export const dynamic = "force-dynamic";

const pp = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("es-CO", { maximumFractionDigits: 1 })} pp`;
const VARIANTE_ESTADO = { EN_CURSO: "warning", COMPLETADA: "success", CANCELADA: "muted" } as const;
const VARIANTE_ESTUDIANTE = { ACTIVO: "default", GRADUADO: "success", DESERTOR: "danger", APLAZADO: "warning" } as const;

/** Efectividad: se calcula aparte (recorre toda la historia) y llega en streaming */
async function SeccionEfectividad() {
  const ef = await new ServicioIntervenciones().efectividad();
  const g = ef.general;
  const filas = [
    { clave: "TODAS", efecto: g.efectoAjustado, ic95: g.ic95, n: g.tratadosComparables, significativo: g.significativo },
    ...ef.porTipo.map((t) => ({ clave: t.tipo, efecto: t.efectoAjustado, ic95: t.ic95, n: t.tratadosComparables, significativo: t.significativo })),
  ];
  return (
    <section className="space-y-6" aria-labelledby="titulo-efectividad">
      <div className="space-y-1">
        <h2 id="titulo-efectividad" className="text-xl font-bold">¿Funcionan las intervenciones?</h2>
        <p className="text-sm text-muted-foreground">
          {ef.observaciones.toLocaleString("es-CO")} estudiante-semestres desde {ef.desde ?? "—"} con desenlace conocido · permanecer = no desertar ese semestre ni el siguiente · modelo {ef.modeloVersion}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm text-muted-foreground">Comparación ingenua</p>
            <p className="text-3xl font-bold tabular-nums">{pp(g.diferenciaIngenua)}</p>
            <p className="text-xs text-muted-foreground">Intervenidos {g.tratados.tasa.toLocaleString("es-CO")} % vs. no intervenidos {g.controles.tasa.toLocaleString("es-CO")} %. Engañosa: se atiende a los de mayor riesgo.</p>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="space-y-1 p-5">
            <p className="text-sm text-muted-foreground">Efecto ajustado por riesgo</p>
            <p className="text-3xl font-bold tabular-nums">{g.efectoAjustado === null ? "—" : pp(g.efectoAjustado)}</p>
            <p className="text-xs text-muted-foreground">{g.ic95 ? `IC 95 %: ${pp(g.ic95[0])} a ${pp(g.ic95[1])} · ${g.significativo ? "significativo" : "aún no concluyente"}` : "Sin datos comparables"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm text-muted-foreground">Estudiantes intervenidos evaluados</p>
            <p className="text-3xl font-bold tabular-nums">{g.tratados.n.toLocaleString("es-CO")}</p>
            <p className="text-xs text-muted-foreground">{g.tratados.permanecieron.toLocaleString("es-CO")} permanecieron un año después ({g.tratados.tasa.toLocaleString("es-CO")} %).</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Efecto estimado por tipo de intervención</CardTitle>
          <CardDescription>Efecto promedio en los intervenidos (ATT) comparando dentro de franjas de riesgo similar.</CardDescription>
        </CardHeader>
        <CardContent>
          <EfectoForest filas={filas} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GraficaEstratos estratos={g.estratos} />
        <GraficaCobertura cobertura={ef.cobertura} />
      </div>

      <Alert variant="info" titulo="Cómo leer este análisis">
        <ul className="list-disc space-y-1 pl-4">
          {ef.interpretacion.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </Alert>
    </section>
  );
}

function CargandoEfectividad() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Calculando la efectividad">
      <Skeleton className="h-7 w-72" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default async function IntervencionesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const plano: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v !== "") plano[k] = v;
  const analisis = listaIntervencionesSchema.safeParse(plano);
  const filtros = analisis.success ? analisis.data : listaIntervencionesSchema.parse({});
  const lista = await new ServicioIntervenciones().listar(filtros);
  const paramsPaginacion = Object.fromEntries(Object.entries(plano).filter(([k]) => k !== "pagina"));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Intervenciones de Bienestar</h1>
          <p className="max-w-3xl text-muted-foreground">Registro y seguimiento de tutorías, apoyos económicos, acompañamiento psicológico y orientación vocacional, y medición de si ayudan a que los estudiantes permanezcan.</p>
        </div>
        <RegistrarIntervencion />
      </header>

      {!analisis.success && <Alert variant="warning">Algún filtro de la URL no era válido y se ignoró.</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { t: "En curso", v: lista.resumen.EN_CURSO.toLocaleString("es-CO") },
          { t: "Completadas", v: lista.resumen.COMPLETADA.toLocaleString("es-CO") },
          { t: "Canceladas", v: lista.resumen.CANCELADA.toLocaleString("es-CO") },
          { t: "Apoyos económicos entregados", v: formatoCOPCompacto(lista.resumen.montoTotal) },
        ].map((k) => (
          <Card key={k.t}>
            <CardContent className="space-y-1 p-5">
              <p className="text-sm text-muted-foreground">{k.t}</p>
              <p className="text-2xl font-bold tabular-nums">{k.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de intervenciones</CardTitle>
          <CardDescription>La columna «Situación hoy» muestra si el estudiante sigue estudiando, se graduó o desertó.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FiltrosIntervenciones />
          {lista.filas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No hay intervenciones con esos filtros.</p>
          ) : (
            <Table>
              <THead>
                <TR><TH>Estudiante</TH><TH>Intervención</TH><TH>Periodo</TH><TH>Estado</TH><TH>Situación hoy</TH><TH>Responsable</TH><TH><span className="sr-only">Acciones</span></TH></TR>
              </THead>
              <TBody>
                {lista.filas.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <Link href={`/alerta-temprana/${i.estudianteId}`} className="font-medium text-primary hover:underline">{i.estudiante}</Link>
                      <p className="text-xs text-muted-foreground">{i.codigo} · {i.programa}</p>
                    </TD>
                    <TD className="max-w-sm">
                      <p className="font-medium">{TIPO_INTERVENCION[i.tipo]}{i.montoApoyo ? ` · ${formatoCOP(i.montoApoyo)}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{i.descripcion}</p>
                      {i.resultado && <p className="mt-1 text-xs"><span className="font-semibold">Resultado:</span> {i.resultado}</p>}
                    </TD>
                    <TD className="whitespace-nowrap">{i.periodo ?? "—"}</TD>
                    <TD><Badge variant={VARIANTE_ESTADO[i.estado]}>{ESTADO_INTERVENCION[i.estado]}</Badge></TD>
                    <TD><Badge variant={VARIANTE_ESTUDIANTE[i.estadoEstudiante as keyof typeof VARIANTE_ESTUDIANTE] ?? "muted"}>{ESTADO_ESTUDIANTE[i.estadoEstudiante] ?? i.estadoEstudiante}</Badge></TD>
                    <TD className="text-xs">{i.responsable}</TD>
                    <TD>{i.estado === "EN_CURSO" && <CerrarIntervencion id={i.id} estudiante={i.estudiante} />}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <Paginacion pagina={lista.pagina} paginas={lista.paginas} total={lista.total} base="/intervenciones" params={paramsPaginacion} unidad="intervenciones" />
        </CardContent>
      </Card>

      <Suspense fallback={<CargandoEfectividad />}>
        <SeccionEfectividad />
      </Suspense>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Datos individuales visibles solo para Bienestar y Administración (Ley 1581 de 2012). Cada registro o cierre queda en la auditoría.
      </p>
    </div>
  );
}
