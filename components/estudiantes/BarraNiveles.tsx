import { COLOR_NIVEL } from "@/lib/paleta";
import { ETIQUETA_NIVEL, NIVELES } from "@/services/riesgo/niveles";
import { ICONO_NIVEL } from "./NivelBadge";

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
    <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-sm" role="img" aria-label={`${alto} en riesgo alto, ${medio} medio y ${bajo} bajo`}>
      {partes.map((p, i) => (
        <div key={i} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} title={String(p.n)} />
      ))}
    </div>
  );
}

export function LeyendaNiveles() {
  return (
    <div className="flex flex-wrap gap-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-grafito">
      {NIVELES.map((nivel) => {
        const Icono = ICONO_NIVEL[nivel];
        return (
          <span key={nivel} className="inline-flex items-center gap-1">
            <Icono className="h-3.5 w-3.5" style={{ color: COLOR_NIVEL[nivel] }} aria-hidden /> {ETIQUETA_NIVEL[nivel]}
          </span>
        );
      })}
    </div>
  );
}
