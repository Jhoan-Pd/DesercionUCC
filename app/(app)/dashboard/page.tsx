import { Info } from "lucide-react";
import { filtrosDashboardSchema } from "@/lib/validators/dashboard";
import { ServicioDashboard } from "@/services/dashboard/ServicioDashboard";
import { Alert } from "@/components/ui/alert";
import { FiltrosDashboard } from "@/components/dashboard/FiltrosDashboard";
import { TarjetasKpi } from "@/components/dashboard/TarjetasKpi";
import {
  GraficaCausas,
  GraficaCohorte,
  GraficaMunicipio,
  GraficaPeriodo,
  GraficaPrograma,
  GraficaSemestre,
  GraficaSupervivencia,
} from "@/components/dashboard/Graficas";

export const metadata = { title: "Dashboard institucional" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // Los filtros llegan por la URL: se validan con Zod; si algo es inválido se ignora y se avisa
  const plano: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v !== "") plano[k] = v;
  const analisis = filtrosDashboardSchema.safeParse(plano);
  const filtros = analisis.success ? analisis.data : {};

  const resumen = await new ServicioDashboard().obtenerResumen(filtros);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard institucional</h1>
        <p className="text-muted-foreground">
          Deserción por cohorte, programa, semestre y periodo · Periodo actual {resumen.periodoActual ?? "—"} · Datos sintéticos de demostración
        </p>
      </header>

      {!analisis.success && <Alert variant="warning">Algún filtro de la URL no era válido y se ignoró.</Alert>}

      <FiltrosDashboard opciones={resumen.opciones} />

      {resumen.kpis.total === 0 ? (
        <Alert variant="info" titulo="Sin resultados">
          Ningún estudiante cumple esa combinación de filtros. Prueba quitando alguno.
        </Alert>
      ) : (
        <>
          <TarjetasKpi kpis={resumen.kpis} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GraficaCohorte datos={resumen.porCohorte} />
            <GraficaPrograma datos={resumen.porPrograma} />
            <GraficaSemestre datos={resumen.porSemestre} />
            <GraficaPeriodo datos={resumen.porPeriodo} referenciaAnual={resumen.referencias.desercionAnualUniversitaria} />
            <GraficaSupervivencia datos={resumen.supervivencia} />
            <GraficaCausas datos={resumen.causas} />
            <GraficaMunicipio datos={resumen.porMunicipio} />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Referencias nacionales: SPADIES (Ministerio de Educación Nacional), editables por el administrador. Los reportes y gráficas usan datos agregados; no se muestran datos personales.
          </p>
        </>
      )}
    </div>
  );
}
