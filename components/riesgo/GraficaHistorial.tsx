"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { TarjetaGrafica } from "@/components/dashboard/TarjetaGrafica";

interface Nota {
  semestre: number;
  periodo: string;
  enCurso: boolean;
  promedio: number;
  materiasPerdidas: number;
  asistenciaPct: number;
}

/** Evolución del promedio por semestre (la asistencia y las materias perdidas van en la tabla y el tooltip) */
export function GraficaHistorial({ notas }: { notas: Nota[] }) {
  const datos = notas.map((n) => ({ ...n, etiqueta: `S${n.semestre}${n.enCurso ? "*" : ""}` }));
  return (
    <TarjetaGrafica
      titulo="Historial académico"
      descripcion="Promedio por semestre. La línea punteada marca 3,0 (nota mínima aprobatoria)."
      nota="* Semestre en curso: notas parciales."
      vacio={datos.length === 0}
      tabla={{
        columnas: ["Semestre", "Periodo", "Promedio", "Materias perdidas", "Asistencia"],
        filas: datos.map((n) => [n.etiqueta, n.periodo, n.promedio, n.materiasPerdidas, `${n.asistenciaPct}%`]),
      }}
    >
      <div className="h-64" role="img" aria-label="Gráfica de líneas del promedio por semestre">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} width={32} />
            <ReferenceLine y={3} stroke="#dc2626" strokeDasharray="5 4" />
            <Tooltip
              content={({ active, payload }: TooltipProps<number, string>) => {
                if (!active || !payload?.length) return null;
                const n = payload[0].payload as Nota & { etiqueta: string };
                return (
                  <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold">Semestre {n.semestre} · {n.periodo}{n.enCurso ? " (en curso)" : ""}</p>
                    <p>Promedio: <b>{n.promedio.toLocaleString("es-CO")}</b></p>
                    <p>Materias perdidas: <b>{n.materiasPerdidas}</b></p>
                    <p>Asistencia: <b>{n.asistenciaPct.toLocaleString("es-CO")}%</b></p>
                  </div>
                );
              }}
            />
            <Line dataKey="promedio" stroke="#00549F" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}
