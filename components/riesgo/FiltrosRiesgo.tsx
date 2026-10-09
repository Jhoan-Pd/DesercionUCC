"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/** Filtros de la lista priorizada (estado en la URL, igual que el dashboard) */
export function FiltrosRiesgo({ programas }: { programas: { id: string; nombre: string }[] }) {
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
    nuevo.delete("pagina"); // al filtrar se vuelve a la primera página
    iniciar(() => router.push(`${pathname}?${nuevo.toString()}`));
  }

  return (
    <section aria-label="Filtros" className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex min-w-[220px] flex-[2] items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            aplicar({ busqueda: texto.trim().length >= 2 ? texto.trim() : "" });
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="busqueda" className="text-xs text-muted-foreground">Buscar por nombre o código</Label>
            <Input id="busqueda" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Rosero o UCC2024" />
          </div>
          <Button type="submit" variant="outline" aria-label="Buscar" disabled={pendiente}>
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        </form>
        <div className="min-w-[140px] flex-1 space-y-1.5">
          <Label htmlFor="nivel" className="text-xs text-muted-foreground">Nivel de riesgo</Label>
          <Select id="nivel" value={params.get("nivel") ?? ""} onChange={(e) => aplicar({ nivel: e.target.value })} disabled={pendiente}>
            <option value="">Todos</option>
            <option value="ALTO">Alto</option>
            <option value="MEDIO">Medio</option>
            <option value="BAJO">Bajo</option>
          </Select>
        </div>
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label htmlFor="programaId" className="text-xs text-muted-foreground">Programa</Label>
          <Select id="programaId" value={params.get("programaId") ?? ""} onChange={(e) => aplicar({ programaId: e.target.value })} disabled={pendiente}>
            <option value="">Todos</option>
            {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
        </div>
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <Label htmlFor="conAlerta" className="text-xs text-muted-foreground">Alertas</Label>
          <Select id="conAlerta" value={params.get("conAlerta") ?? ""} onChange={(e) => aplicar({ conAlerta: e.target.value })} disabled={pendiente}>
            <option value="">Todas</option>
            <option value="true">Con alerta abierta</option>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setTexto("");
            iniciar(() => router.push(pathname));
          }}
          disabled={params.toString().length === 0 || pendiente}
        >
          {pendiente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FilterX className="h-4 w-4" aria-hidden />} Limpiar
        </Button>
      </div>
    </section>
  );
}
