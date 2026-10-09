"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalculadoraInstitucional, type LineaBase } from "@/services/institucional/CalculadoraInstitucional";
import { formatoCOPCompacto, formatoPct } from "@/lib/utils";

/**
 * "¿Y si la deserción bajara un X %?": el cálculo es una función pura, así que se rehace en el
 * navegador al mover el control, sin volver a consultar el servidor.
 */
export function ProyeccionDesercion({ base, periodos }: { base: LineaBase; periodos: string[] }) {
  const [reduccion, setReduccion] = useState(20);
  const p = useMemo(() => CalculadoraInstitucional.proyectar(base, reduccion), [base, reduccion]);

  const tiles = [
    { t: "Estudiantes que seguirían estudiando", v: `${p.estudiantesRetenidosAnio.toLocaleString("es-CO")} por año`, d: `de ${base.desertoresAnuales} que hoy desertan al año` },
    { t: "Matrícula recuperada", v: `${formatoCOPCompacto(p.ingresosRecuperadosAnio)} por año`, d: `${formatoCOPCompacto(p.ingresosRecuperados5Anios)} en 5 años` },
    { t: "Deserción anual", v: formatoPct(p.tasaDesercionAnualNueva), d: `hoy ${formatoPct(base.tasaDesercionAnual)}` },
    { t: "Graduación de las cohortes", v: formatoPct(p.tasaGraduacionNueva), d: `hoy ${formatoPct(base.tasaGraduacion)} (+${p.gananciaGraduacion.toLocaleString("es-CO")} pp)` },
    { t: "Ingresos de por vida que gana la región", v: `${formatoCOPCompacto(p.perdidaRegionalEvitadaAnio)} por año`, d: "valor presente a 20 años" },
  ];

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" aria-hidden /> Proyección: ¿y si la deserción bajara?</CardTitle>
        <CardDescription>Línea base: último año académico cerrado ({periodos.join(" y ")}). Los estudiantes que se quedan se gradúan en la misma proporción que sus compañeros.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="reduccion" className="flex items-baseline justify-between text-sm font-medium">
            <span>Reducción de la deserción</span>
            <span className="text-2xl font-bold tabular-nums text-primary">{reduccion} %</span>
          </label>
          <input
            id="reduccion"
            type="range"
            min={0}
            max={50}
            step={5}
            value={reduccion}
            onChange={(e) => setReduccion(Number(e.target.value))}
            className="w-full accent-[#00549F]"
            aria-valuetext={`${reduccion} por ciento`}
          />
          <div className="flex justify-between text-xs text-muted-foreground"><span>0 %</span><span>25 %</span><span>50 %</span></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-live="polite">
          {tiles.map((x) => (
            <div key={x.t} className="rounded-lg border bg-secondary/40 p-4">
              <p className="text-xs text-muted-foreground">{x.t}</p>
              <p className="text-xl font-bold tabular-nums">{x.v}</p>
              <p className="text-xs text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
