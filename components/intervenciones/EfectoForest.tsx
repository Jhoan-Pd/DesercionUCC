import { TIPO_INTERVENCION } from "@/lib/etiquetas";
import { COLOR } from "@/lib/colores";

export interface FilaEfecto {
  clave: string;
  efecto: number | null;
  ic95: [number, number] | null;
  n: number;
  significativo: boolean;
}

const pp = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("es-CO", { maximumFractionDigits: 1 })} pp`;

/**
 * Gráfico de bosque (forest plot): punto = efecto estimado, línea = intervalo de confianza del 95 %.
 * Si la línea cruza el cero (línea vertical), el efecto aún no es concluyente.
 */
export function EfectoForest({ filas }: { filas: FilaEfecto[] }) {
  const conDatos = filas.filter((f) => f.efecto !== null && f.ic95);
  if (conDatos.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No hay suficientes datos comparables para estimar el efecto.</p>;
  const min = Math.min(0, ...conDatos.map((f) => f.ic95![0]));
  const max = Math.max(0, ...conDatos.map((f) => f.ic95![1]));
  const margen = (max - min) * 0.08 || 5;
  const a = min - margen;
  const b = max + margen;
  const x = (v: number) => `${((v - a) / (b - a)) * 100}%`;
  const marcas = [Math.ceil(a / 5) * 5];
  while (marcas[marcas.length - 1] + 5 <= b) marcas.push(marcas[marcas.length - 1] + 5);

  return (
    <div role="img" aria-label="Efecto estimado de cada tipo de intervención sobre la permanencia, con su intervalo de confianza">
      <div className="space-y-1">
        {filas.map((f) => (
          <div key={f.clave} className="grid grid-cols-[minmax(110px,180px)_1fr_minmax(92px,120px)] items-center gap-3 py-1.5 text-sm">
            <span className={f.clave === "TODAS" ? "font-semibold" : undefined}>
              {f.clave === "TODAS" ? "Todas las intervenciones" : TIPO_INTERVENCION[f.clave]}
              <span className="block text-xs text-muted-foreground">{f.n.toLocaleString("es-CO")} intervenidos</span>
            </span>
            <div className="relative h-6">
              <div className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: x(0) }} aria-hidden />
              {f.efecto !== null && f.ic95 && (
                <>
                  <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded bg-slate-400" style={{ left: x(f.ic95[0]), width: `calc(${x(f.ic95[1])} - ${x(f.ic95[0])})` }} aria-hidden />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                    style={{ left: x(f.efecto), background: f.significativo ? COLOR.ucc : "#64748b" }}
                    aria-hidden
                  />
                </>
              )}
            </div>
            <span className="text-right tabular-nums">
              {f.efecto === null ? "—" : <><b>{pp(f.efecto)}</b>{f.significativo && <span className="block text-[11px] text-green-800">significativo</span>}</>}
            </span>
          </div>
        ))}
      </div>
      <div className="relative ml-[calc(min(180px,30%)+0.75rem)] mr-[calc(120px+0.75rem)] mt-1 h-5 border-t text-[11px] text-muted-foreground" aria-hidden>
        {marcas.map((m) => (
          <span key={m} className="absolute -translate-x-1/2 pt-0.5" style={{ left: x(m) }}>{m}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Diferencia de permanencia en puntos porcentuales frente a estudiantes NO intervenidos con riesgo similar. Línea gris: intervalo de confianza del 95 %. Punto azul: estadísticamente significativo.</p>
    </div>
  );
}
