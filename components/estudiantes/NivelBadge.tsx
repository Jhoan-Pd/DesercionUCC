import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETA_NIVEL, type NivelRiesgo } from "@/services/riesgo/niveles";

/** Ícono de cada nivel (también lo usa la leyenda de las barras) */
export const ICONO_NIVEL: Readonly<Record<NivelRiesgo, typeof CheckCircle2>> = { BAJO: CheckCircle2, MEDIO: AlertTriangle, ALTO: AlertOctagon };

const CLASE_NIVEL: Readonly<Record<NivelRiesgo, string>> = {
  BAJO: "bg-riesgo-bajo-fondo text-riesgo-bajo ring-riesgo-bajo-borde",
  MEDIO: "bg-riesgo-medio-fondo text-riesgo-medio ring-riesgo-medio-borde",
  ALTO: "bg-riesgo-alto-fondo text-riesgo-alto ring-riesgo-alto-borde",
};

/** Nivel de riesgo: color de estado + ícono + texto (nunca solo color) */
export function NivelBadge({ nivel, className }: { nivel: NivelRiesgo; className?: string }) {
  const Icono = ICONO_NIVEL[nivel];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset", CLASE_NIVEL[nivel], className)}>
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {ETIQUETA_NIVEL[nivel]}
    </span>
  );
}
