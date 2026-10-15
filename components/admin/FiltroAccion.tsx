"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/** Filtro por tipo de acción de la auditoría (en la URL) */
export function FiltroAccion({ acciones }: { acciones: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="max-w-xs space-y-1.5">
      <Label htmlFor="f-accion" className="text-xs text-muted-foreground">Acción</Label>
      <Select id="f-accion" value={params.get("accion") ?? ""} onChange={(e) => router.push(e.target.value ? `${pathname}?accion=${e.target.value}` : pathname)}>
        <option value="">Todas</option>
        {Object.entries(acciones).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
    </div>
  );
}
