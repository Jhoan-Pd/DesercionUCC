import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { COLOR_NIVEL } from "./NivelBadge";

/** Barra apilada alto/medio/bajo de un programa (con texto accesible) */
export function BarraNiveles({ alto, medio, bajo }: { alto: number; medio: number; bajo: number }) {
  const total = alto + medio + bajo;
  if (total === 0) return null;
  const partes = [
    { n: alto, color: COLOR_NIVEL.ALTO },
    { n: medio, color: COLOR_NIVEL.MEDIO },
    { n: bajo, color: COLOR_NIVEL.BAJO },
  ].filter((p) => p.n > 0);
  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={`${alto} en riesgo alto, ${medio} medio y ${bajo} bajo`}>
      {partes.map((p, i) => (
        <div key={i} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} title={String(p.n)} />
      ))}
    </div>
  );
}

export function LeyendaNiveles() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <AlertOctagon className="h-3.5 w-3.5" style={{ color: COLOR_NIVEL.ALTO }} aria-hidden /> Alto
      </span>
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" style={{ color: COLOR_NIVEL.MEDIO }} aria-hidden /> Medio
      </span>
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: COLOR_NIVEL.BAJO }} aria-hidden /> Bajo
      </span>
    </div>
  );
}
