import { BarChart3, Bell, Calculator, ClipboardList, FileText, GraduationCap, HeartHandshake, Landmark, Settings, type LucideIcon } from "lucide-react";
import type { Modulo } from "@/lib/modulos";

const MAPA: Record<Modulo["icono"], LucideIcon> = {
  dashboard: BarChart3,
  calculadora: Calculator,
  alerta: Bell,
  encuesta: ClipboardList,
  docente: GraduationCap,
  intervenciones: HeartHandshake,
  institucional: Landmark,
  reportes: FileText,
  admin: Settings,
};

export function IconoModulo({ icono, className }: { icono: Modulo["icono"]; className?: string }) {
  const Icono = MAPA[icono];
  return <Icono className={className} aria-hidden />;
}
