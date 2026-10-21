import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Nivel = "BAJO" | "MEDIO" | "ALTO";

const ESTILOS: Record<Nivel, { clase: string; Icono: typeof CheckCircle2; texto: string }> = {
  BAJO: { clase: "bg-riesgo-bajo-fondo text-riesgo-bajo ring-riesgo-bajo-borde", Icono: CheckCircle2, texto: "Bajo" },
  MEDIO: { clase: "bg-riesgo-medio-fondo text-riesgo-medio ring-riesgo-medio-borde", Icono: AlertTriangle, texto: "Medio" },
  ALTO: { clase: "bg-riesgo-alto-fondo text-riesgo-alto ring-riesgo-alto-borde", Icono: AlertOctagon, texto: "Alto" },
};

/** Nivel de riesgo: color de estado + ícono + texto (nunca solo color) */
export function NivelBadge({ nivel, className }: { nivel: Nivel; className?: string }) {
  const { clase, Icono, texto } = ESTILOS[nivel];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset", clase, className)}>
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {texto}
    </span>
  );
}

/** Colores de los niveles en gráficas y barras: salvia, ocre y coral apagado */
export const COLOR_NIVEL: Record<Nivel, string> = { BAJO: "#5E8C6A", MEDIO: "#B07D1E", ALTO: "#C2264E" };
