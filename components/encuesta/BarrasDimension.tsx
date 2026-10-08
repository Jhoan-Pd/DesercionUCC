import { DIMENSIONES, type Dimension } from "@/services/encuesta/preguntas";

/** Puntaje 0-100 por dimensión con barra y número visibles */
export function BarrasDimension({ puntajes }: { puntajes: Partial<Record<Dimension, number>> }) {
  const dims = Object.keys(DIMENSIONES) as Dimension[];
  return (
    <dl className="space-y-3">
      {dims.map((d) => {
        const v = puntajes[d] ?? 0;
        const color = v >= 55 ? "#dc2626" : v >= 35 ? "#d97706" : "#15803d";
        return (
          <div key={d}>
            <div className="flex justify-between text-sm">
              <dt>{DIMENSIONES[d].titulo}</dt>
              <dd className="font-semibold tabular-nums">{v}/100</dd>
            </div>
            <div className="mt-1 h-2 rounded-full bg-secondary" role="presentation">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(2, v)}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </dl>
  );
}
