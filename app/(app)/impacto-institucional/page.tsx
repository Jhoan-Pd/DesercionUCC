import Link from "next/link";
import { BookX, Building2, Calculator, Info, MapPinned, Wallet } from "lucide-react";
import { filtrosInstitucionalSchema } from "@/lib/validators/institucional";
import { ServicioImpactoInstitucional } from "@/services/institucional/ServicioImpactoInstitucional";
import { formatoCOP, formatoCOPCompacto } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FiltroPrograma } from "@/components/institucional/FiltroPrograma";
import { ProyeccionDesercion } from "@/components/institucional/ProyeccionDesercion";
import { GraficaGraduacion, GraficaMatriculaAnio, GraficaMatriculaPrograma, GraficaRegional } from "@/components/institucional/GraficasInstitucional";

export const metadata = { title: "Impacto institucional" };
export const dynamic = "force-dynamic";

function Dimension({ icono, titulo, valor, detalle, children }: { icono: React.ReactNode; titulo: string; valor: string; detalle: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">{icono}{titulo}</div>
        <p className="text-2xl font-bold tabular-nums">{valor}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default async function ImpactoInstitucionalPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const valido = filtrosInstitucionalSchema.safeParse({ programaId: typeof searchParams.programaId === "string" && searchParams.programaId ? searchParams.programaId : undefined });
  const r = await new ServicioImpactoInstitucional().obtener(valido.success ? valido.data : {});
  const programa = r.programas.find((p) => p.id === r.filtros.programaId)?.nombre;
  const porDesertor = r.desertores ? r.perdidaRegionalTotal / r.desertores : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Impacto institucional y regional</h1>
          <p className="max-w-3xl text-muted-foreground">
            Cuánto le cuesta la deserción a la UCC y a la región{programa ? ` · ${programa}` : ""}. Montos en pesos de hoy · periodo actual {r.periodoActual ?? "—"}.
          </p>
        </div>
        <FiltroPrograma programas={r.programas} />
      </header>

      {!valido.success && <Alert variant="warning">El programa de la URL no es válido; se muestra toda la universidad.</Alert>}

      {r.desertores === 0 ? (
        <Alert variant="info" titulo="Sin desertores">No hay estudiantes retirados para este filtro.</Alert>
      ) : (
        <>
          <section aria-label="Las cuatro dimensiones del impacto" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Dimension icono={<Wallet className="h-4 w-4" aria-hidden />} titulo="Económica (estudiante y familia)" valor={formatoCOPCompacto(porDesertor)} detalle={`Ingresos de por vida (VP ${r.horizonteAnios} años) que pierde en promedio cada desertor frente a graduarse.`}>
              <Link href="/calculadora" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Calculator className="h-3.5 w-3.5" aria-hidden /> Ver un caso individual</Link>
            </Dimension>
            <Dimension icono={<BookX className="h-4 w-4" aria-hidden />} titulo="Académica" valor={`${r.semestresCursadosSinTitulo.toLocaleString("es-CO")} semestres`} detalle={`Cursados por ${r.desertores.toLocaleString("es-CO")} desertores sin llegar al título (${(r.semestresCursadosSinTitulo / r.desertores).toLocaleString("es-CO", { maximumFractionDigits: 1 })} en promedio).`} />
            <Dimension icono={<Building2 className="h-4 w-4" aria-hidden />} titulo="Institucional (UCC)" valor={formatoCOPCompacto(r.ingresosNoPercibidos)} detalle={`Matrícula no percibida por ${r.semestresNoCursados.toLocaleString("es-CO")} semestres no cursados. Graduación de cohortes: ${r.lineaBase.tasaGraduacion.toLocaleString("es-CO")} %.`} />
            <Dimension icono={<MapPinned className="h-4 w-4" aria-hidden />} titulo="Social y regional" valor={formatoCOPCompacto(r.perdidaRegionalTotal)} detalle={`Ingresos de por vida (VP) que ${r.regional.length} municipios dejan de generar por jóvenes sin título.`} />
          </section>

          <ProyeccionDesercion base={r.lineaBase} periodos={r.periodosBase} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GraficaMatriculaPrograma datos={r.porPrograma} />
            <GraficaMatriculaAnio datos={r.porAnioRetiro} />
            <GraficaGraduacion datos={r.graduacion} />
            <Card>
              <CardContent className="space-y-3 p-5">
                <h2 className="text-base font-semibold">Pérdida por departamento</h2>
                <p className="text-sm text-muted-foreground">Ingresos de por vida no generados (valor presente) según el departamento de origen del estudiante.</p>
                <Table>
                  <THead><TR><TH>Departamento</TH><TH>Desertores</TH><TH>Ingresos no generados</TH></TR></THead>
                  <TBody>
                    {r.departamentos.map((d) => (
                      <TR key={d.municipio}><TD>{d.municipio}</TD><TD>{d.desertores.toLocaleString("es-CO")}</TD><TD>{formatoCOP(d.perdidaIngresoVida)}</TD></TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
            <GraficaRegional datos={r.regional} horizonte={r.horizonteAnios} />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Supuestos: valor actual del semestre de cada programa; un desertor habría cursado los semestres que le faltaban; la pérdida regional compara el salario de enganche del programa con el de un bachiller (Admin → Parámetros). Datos agregados, sin información personal.
          </p>
        </>
      )}
    </div>
  );
}
