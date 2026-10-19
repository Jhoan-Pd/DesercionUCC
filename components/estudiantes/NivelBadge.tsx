import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Nivel = "BAJO" | "MEDIO" | "ALTO";

const ESTILOS: Record<Nivel, { clase: string; Icono: typeof CheckCircle2; texto: string }> = {
  BAJO: { clase: "bg-green-100 text-green-800 ring-green-200", Icono: CheckCircle2, texto: "Bajo" },
  MEDIO: { clase: "bg-amber-100 text-amber-900 ring-amber-200", Icono: AlertTriangle, texto: "Medio" },
  ALTO: { clase: "bg-red-100 text-red-800 ring-red-200", Icono: AlertOctagon, texto: "Alto" },
};

/** Nivel de riesgo: color de estado + ícono + texto (nunca solo color) */
export function NivelBadge({ nivel, className }: { nivel: Nivel; className?: string }) {
  const { clase, Icono, texto } = ESTILOS[nivel];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", clase, className)}>
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {texto}
    </span>
  );
}

export const COLOR_NIVEL: Record<Nivel, string> = { BAJO: "#15803d", MEDIO: "#d97706", ALTO: "#dc2626" };
