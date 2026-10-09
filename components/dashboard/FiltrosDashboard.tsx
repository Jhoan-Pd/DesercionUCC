"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { OpcionesFiltros } from "@/services/dashboard/ServicioDashboard";

const FINANCIACION: Record<string, string> = {
  RECURSOS_PROPIOS: "Recursos propios",
  ICETEX: "ICETEX",
  BECA: "Beca",
  CREDITO_UCC: "Crédito UCC",
};

/**
 * Filtros combinables. El estado vive en la URL (?programaId=...&estrato=...):
 * así los filtros se pueden compartir/guardar y el servidor recalcula con los mismos parámetros.
 */
export function FiltrosDashboard({ opciones }: { opciones: OpcionesFiltros }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  function cambiar(clave: string, valor: string) {
    const nuevo = new URLSearchParams(params.toString());
    if (valor) nuevo.set(clave, valor);
    else nuevo.delete(clave);
    iniciar(() => router.push(`${pathname}?${nuevo.toString()}`));
  }
  const hayFiltros = params.toString().length > 0;

  const campo = (id: string, etiqueta: string, hijos: React.ReactNode) => (
    <div className="min-w-[150px] flex-1 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{etiqueta}</Label>
      <Select id={id} value={params.get(id) ?? ""} onChange={(e) => cambiar(id, e.target.value)} disabled={pendiente}>
        {hijos}
      </Select>
    </div>
  );

  return (
    <section aria-label="Filtros" className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        {campo("programaId", "Programa", <>
          <option value="">Todos</option>
          {opciones.programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </>)}
        {campo("cohorteAnio", "Cohorte (año de ingreso)", <>
          <option value="">Todas</option>
          {opciones.cohortes.map((c) => <option key={c} value={c}>{c}</option>)}
        </>)}
        {campo("estrato", "Estrato", <>
          <option value="">Todos</option>
          {opciones.estratos.map((e) => <option key={e} value={e}>Estrato {e}</option>)}
        </>)}
        {campo("financiacion", "Financiación", <>
          <option value="">Todas</option>
          {Object.entries(FINANCIACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </>)}
        {campo("sexo", "Sexo", <>
          <option value="">Todos</option>
          <option value="F">Femenino</option>
          <option value="M">Masculino</option>
          <option value="O">Otro</option>
        </>)}
        {campo("trabaja", "¿Trabaja?", <>
          <option value="">Todos</option>
          <option value="true">Sí trabaja</option>
          <option value="false">No trabaja</option>
        </>)}
        <Button variant="outline" onClick={() => iniciar(() => router.push(pathname))} disabled={!hayFiltros || pendiente} className="shrink-0">
          {pendiente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FilterX className="h-4 w-4" aria-hidden />}
          Limpiar
        </Button>
      </div>
    </section>
  );
}
