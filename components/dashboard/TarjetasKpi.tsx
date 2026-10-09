import { ArrowDownRight, ArrowUpRight, GraduationCap, UserMinus, Users, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatoNumero, formatoPct } from "@/lib/utils";
import type { Kpis } from "@/services/dashboard/calculos";

function Kpi({ titulo, valor, detalle, icono, destacado }: { titulo: string; valor: string; detalle?: React.ReactNode; icono: React.ReactNode; destacado?: boolean }) {
  return (
    <Card className={destacado ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <p className="text-3xl font-bold tracking-tight">{valor}</p>
          {detalle && <div className="text-xs text-muted-foreground">{detalle}</div>}
        </div>
        <span className="rounded-lg bg-secondary p-2 text-primary">{icono}</span>
      </CardContent>
    </Card>
  );
}

export function TarjetasKpi({ kpis }: { kpis: Kpis }) {
  const brecha = kpis.brechaAnualVsNacional;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        titulo="Estudiantes analizados"
        valor={formatoNumero(kpis.total)}
        icono={<Users className="h-5 w-5" aria-hidden />}
        detalle={`${formatoNumero(kpis.activos)} activos · ${formatoNumero(kpis.graduados)} graduados · ${formatoNumero(kpis.aplazados)} aplazados`}
      />
      <Kpi
        titulo="Desertores"
        valor={formatoNumero(kpis.desertores)}
        icono={<UserMinus className="h-5 w-5" aria-hidden />}
        detalle={`${formatoPct(kpis.tasaAcumulada)} de quienes ingresaron (acumulado)`}
      />
      <Kpi
        titulo="Deserción anual (últimos 2 periodos)"
        valor={kpis.tasaAnual === null ? "—" : formatoPct(kpis.tasaAnual)}
        destacado
        icono={<GraduationCap className="h-5 w-5" aria-hidden />}
        detalle={kpis.ultimoPeriodo ? `Último periodo cerrado: ${kpis.ultimoPeriodo} (${formatoPct(kpis.tasaUltimoPeriodo ?? 0, 2)})` : undefined}
      />
      <Kpi
        titulo="Frente al promedio nacional"
        valor={brecha === null ? "—" : `${brecha > 0 ? "+" : ""}${brecha.toLocaleString("es-CO", { maximumFractionDigits: 1 })} pp`}
        icono={brecha !== null && brecha > 0 ? <ArrowUpRight className="h-5 w-5 text-destructive" aria-hidden /> : brecha !== null ? <ArrowDownRight className="h-5 w-5 text-green-700" aria-hidden /> : <UserCheck className="h-5 w-5" aria-hidden />}
        detalle={
          brecha === null
            ? "Sin datos suficientes"
            : `${brecha > 0 ? "Por encima" : "Por debajo"} de la deserción anual universitaria nacional (${formatoPct(kpis.referenciaAnualNacional, 2)}). pp = puntos porcentuales.`
        }
      />
    </div>
  );
}
