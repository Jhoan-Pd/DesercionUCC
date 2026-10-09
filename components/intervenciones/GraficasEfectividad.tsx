"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { COLOR } from "@/lib/colores";
import { formatoPct } from "@/lib/utils";
import { textoLeyenda } from "@/components/dashboard/leyenda";
import { TarjetaGrafica } from "@/components/dashboard/TarjetaGrafica";
import type { FilaCobertura, FilaEstrato } from "@/services/intervenciones/AnalizadorIntervenciones";

const GRIS = "#94a3b8";
type TP = TooltipProps<number, string>;

function Burbuja({ titulo, lineas }: { titulo: string; lineas: { etiqueta: string; valor: string; color?: string }[] }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{titulo}</p>
      {lineas.map((l) => (
        <p key={l.etiqueta} className="flex items-center gap-2 text-muted-foreground">
          {l.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} aria-hidden />}
          {l.etiqueta}: <span className="font-semibold text-foreground">{l.valor}</span>
        </p>
      ))}
    </div>
  );
}

/** Permanencia de intervenidos vs. no intervenidos dentro de cada franja de riesgo */
export function GraficaEstratos({ estratos }: { estratos: FilaEstrato[] }) {
  const datos = estratos.map((e) => ({ ...e, intervenidos: e.tratados.n ? e.tratados.tasa : null, noIntervenidos: e.controles.n ? e.controles.tasa : null }));
  return (
    <TarjetaGrafica
      titulo="Permanencia por franja de riesgo"
      descripcion="Dentro de cada franja de probabilidad de desertar (según el modelo), % que permaneció un año después."
      nota="Así se comparan estudiantes con riesgo parecido: es la base del efecto ajustado."
      vacio={estratos.every((e) => e.tratados.n === 0)}
      tabla={{
        columnas: ["Franja de riesgo", "Intervenidos (n)", "Permanencia intervenidos", "No intervenidos (n)", "Permanencia no intervenidos", "Diferencia"],
        filas: estratos.map((e) => [e.franja, e.tratados.n, e.tratados.n ? formatoPct(e.tratados.tasa) : "—", e.controles.n, e.controles.n ? formatoPct(e.controles.tasa) : "—", e.diferencia === null ? "—" : `${e.diferencia > 0 ? "+" : ""}${e.diferencia} pp`]),
      }}
    >
      <div className="h-72" role="img" aria-label="Barras agrupadas: permanencia de intervenidos y no intervenidos por franja de riesgo">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="franja" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof datos)[number];
                return (
                  <Burbuja
                    titulo={`Riesgo ${d.franja}`}
                    lineas={[
                      { etiqueta: "Intervenidos", valor: d.tratados.n ? `${formatoPct(d.tratados.tasa)} de ${d.tratados.n}` : "sin casos", color: COLOR.ucc },
                      { etiqueta: "No intervenidos", valor: d.controles.n ? `${formatoPct(d.controles.tasa)} de ${d.controles.n}` : "sin casos", color: GRIS },
                    ]}
                  />
                );
              }}
            />
            <Legend verticalAlign="top" height={28} formatter={textoLeyenda} />
            <Bar dataKey="intervenidos" name="Intervenidos" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar dataKey="noIntervenidos" name="No intervenidos" fill={GRIS} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

/** Qué fracción de los estudiantes en riesgo recibió alguna intervención, por periodo */
export function GraficaCobertura({ cobertura }: { cobertura: FilaCobertura[] }) {
  return (
    <TarjetaGrafica
      titulo="Cobertura del acompañamiento"
      descripcion="% de estudiantes en riesgo (probabilidad ≥ 11 %) que recibió al menos una intervención en el periodo."
      vacio={cobertura.length === 0}
      tabla={{ columnas: ["Periodo", "En riesgo", "Intervenidos", "Cobertura"], filas: cobertura.map((c) => [c.periodo, c.enRiesgo, c.intervenidos, formatoPct(c.cobertura)]) }}
    >
      <div className="h-72" role="img" aria-label="Barras: cobertura de intervenciones sobre estudiantes en riesgo por periodo">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cobertura} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="periodo" tick={{ fontSize: 12 }} interval={0} angle={-35} textAnchor="end" height={52} />
            <YAxis tick={{ fontSize: 12 }} unit="%" width={44} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as FilaCobertura;
                return <Burbuja titulo={`Periodo ${d.periodo}`} lineas={[{ etiqueta: "Cobertura", valor: formatoPct(d.cobertura), color: COLOR.ucc }, { etiqueta: "Intervenidos", valor: `${d.intervenidos} de ${d.enRiesgo} en riesgo` }]} />;
              }}
            />
            <Bar dataKey="cobertura" name="Cobertura" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}
