"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ESTADO_INTERVENCION, TIPO_INTERVENCION } from "@/lib/etiquetas";

/** Filtros de la lista de intervenciones (estado en la URL) */
export function FiltrosIntervenciones() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(params.get("busqueda") ?? "");

  function aplicar(cambios: Record<string, string>) {
    const nuevo = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevo.set(k, v);
      else nuevo.delete(k);
    }
    nuevo.delete("pagina");
    iniciar(() => router.push(`${pathname}?${nuevo.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        className="flex min-w-[220px] flex-[2] items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ busqueda: texto.trim().length >= 2 ? texto.trim() : "" });
        }}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="busqueda-int" className="text-xs text-muted-foreground">Buscar estudiante</Label>
          <Input id="busqueda-int" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o código" />
        </div>
        <Button type="submit" variant="outline" aria-label="Buscar" disabled={pendiente}>
          <Search className="h-4 w-4" aria-hidden />
        </Button>
      </form>
      <div className="min-w-[150px] flex-1 space-y-1.5">
        <Label htmlFor="estado-int" className="text-xs text-muted-foreground">Estado</Label>
        <Select id="estado-int" value={params.get("estado") ?? ""} onChange={(e) => aplicar({ estado: e.target.value })} disabled={pendiente}>
          <option value="">Todos</option>
          {Object.entries(ESTADO_INTERVENCION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <div className="min-w-[180px] flex-1 space-y-1.5">
        <Label htmlFor="tipo-int" className="text-xs text-muted-foreground">Tipo</Label>
        <Select id="tipo-int" value={params.get("tipo") ?? ""} onChange={(e) => aplicar({ tipo: e.target.value })} disabled={pendiente}>
          <option value="">Todos</option>
          {Object.entries(TIPO_INTERVENCION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          setTexto("");
          iniciar(() => router.push(pathname, { scroll: false }));
        }}
        disabled={pendiente || params.toString() === ""}
      >
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FilterX className="h-4 w-4" aria-hidden />} Limpiar
      </Button>
    </div>
  );
}
