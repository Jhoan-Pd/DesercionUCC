import { Bot, Home, Landmark, Upload, Users, UserSearch, type LucideIcon } from "lucide-react";
import type { Modulo } from "@/lib/modulos";

const MAPA: Record<Modulo["icono"], LucideIcon> = {
  inicio: Home,
  estudiantes: UserSearch,
  agente: Bot,
  cifras: Landmark,
  cargar: Upload,
  usuarios: Users,
};

export function IconoModulo({ icono, className }: { icono: Modulo["icono"]; className?: string }) {
  const Icono = MAPA[icono];
  return <Icono className={className} aria-hidden />;
}
