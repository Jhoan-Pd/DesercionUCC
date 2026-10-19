import { COLOR_NIVEL } from "./NivelBadge";

/** Puntaje 0-100 con una barra corta; el número siempre es visible */
export function BarraPuntaje({ puntaje, nivel }: { puntaje: number; nivel: "BAJO" | "MEDIO" | "ALTO" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right text-sm font-semibold tabular-nums">{puntaje}</span>
      <div className="h-2 w-20 rounded-full bg-secondary" role="presentation">
        <div className="h-2 rounded-full" style={{ width: `${Math.max(3, Math.min(100, puntaje))}%`, background: COLOR_NIVEL[nivel] }} />
      </div>
    </div>
  );
}
