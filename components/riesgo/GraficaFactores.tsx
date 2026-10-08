"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { ModeloRiesgo, type Factor } from "@/services/riesgo/ModeloRiesgo";
import { TarjetaGrafica } from "@/components/dashboard/TarjetaGrafica";

const AUMENTA = "#eb6834";
const PROTEGE = "#2a78d6";

/**
 * Explicación del puntaje: cuánto aleja cada factor a este estudiante de uno "promedio"
 * (en log-odds). Barras naranjas aumentan el riesgo; azules lo reducen.
 */
export function GraficaFactores({ factores }: { factores: Factor[] }) {
  const datos = factores
    .filter((f) => Math.abs(f.aporte) >= 0.02)
    .slice(0, 8)
    .map((f) => ({ ...f, nombre: f.etiqueta.length > 34 ? `${f.etiqueta.slice(0, 32)}…` : f.etiqueta, aporte: Math.round(f.aporte * 100) / 100 }));
  return (
    <TarjetaGrafica
      titulo="¿Por qué este puntaje?"
      descripcion="Factores que más alejan a este estudiante de uno promedio. Naranja: aumenta el riesgo. Azul: lo reduce."
      nota="La explicación es exacta: la suma de los aportes más el valor base del modelo reconstruye la probabilidad."
      vacio={datos.length === 0}
      tabla={{
        columnas: ["Factor", "Valor del estudiante", "Aporte (log-odds)", "Efecto"],
        filas: datos.map((f) => [ModeloRiesgo.describir(f), f.formato === "binario" ? (f.valor >= 0.5 ? "Sí" : "No") : f.valor, f.aporte, f.aporte > 0 ? "Aumenta" : "Reduce"]),
      }}
    >
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: AUMENTA }} aria-hidden /> Aumenta el riesgo</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PROTEGE }} aria-hidden /> Reduce el riesgo</span>
      </div>
      <div style={{ height: Math.max(220, datos.length * 40 + 30) }} role="img" aria-label="Gráfica de barras divergentes con el aporte de cada factor al riesgo">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="nombre" width={200} tick={{ fontSize: 12 }} />
            <ReferenceLine x={0} stroke="#1b2430" />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TooltipProps<number, string>) => {
                if (!active || !payload?.length) return null;
                const f = payload[0].payload as Factor;
                return (
                  <div className="max-w-xs rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold">{ModeloRiesgo.describir(f)}</p>
                    <p className="text-muted-foreground">{f.aporte > 0 ? "Aumenta" : "Reduce"} el riesgo ({f.aporte > 0 ? "+" : ""}{f.aporte.toLocaleString("es-CO")} en log-odds)</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="aporte" radius={4} maxBarSize={22}>
              {datos.map((f) => <Cell key={f.clave} fill={f.aporte > 0 ? AUMENTA : PROTEGE} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}
