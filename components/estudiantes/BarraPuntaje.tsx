import { COLOR_NIVEL } from "./NivelBadge";

/** Puntaje 0-100 con una barra corta; el número siempre es visible */
export function BarraPuntaje({ puntaje, nivel }: { puntaje: number; nivel: "BAJO" | "MEDIO" | "ALTO" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right font-serif text-[20px] font-semibold leading-none lining-nums tabular-nums">{puntaje}</span>
      <div className="h-1.5 w-20 rounded-full bg-secondary" role="presentation">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, Math.min(100, puntaje))}%`, background: COLOR_NIVEL[nivel] }} />
      </div>
    </div>
  );
}
