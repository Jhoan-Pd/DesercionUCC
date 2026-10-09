"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/** Filtro por programa guardado en la URL */
export function FiltroPrograma({ programas }: { programas: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex min-w-[240px] items-end gap-2">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="programa-inst" className="text-xs text-muted-foreground">Programa</Label>
        <Select
          id="programa-inst"
          value={params.get("programaId") ?? ""}
          disabled={pendiente}
          onChange={(e) => iniciar(() => router.push(e.target.value ? `${pathname}?programaId=${e.target.value}` : pathname, { scroll: false }))}
        >
          <option value="">Toda la universidad</option>
          {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Select>
      </div>
      {pendiente && <Loader2 className="mb-3 h-4 w-4 animate-spin text-muted-foreground" aria-label="Cargando" />}
    </div>
  );
}
