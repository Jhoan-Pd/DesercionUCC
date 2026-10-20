import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Paginación por enlaces que conserva los filtros de la URL */
export function Paginacion({ pagina, paginas, total, base, params, unidad = "estudiantes" }: { pagina: number; paginas: number; total: number; base: string; params: Record<string, string>; unidad?: string }) {
  const url = (p: number) => {
    const q = new URLSearchParams(params);
    if (p > 1) q.set("pagina", String(p));
    else q.delete("pagina");
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const clase = "inline-flex h-9 items-center gap-1 rounded-sm border border-tinta/25 bg-card px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-tinta hover:border-tinta";
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="meta">{total.toLocaleString("es-CO")} {unidad} · página {pagina} de {paginas}</span>
      <div className="flex gap-2">
        {pagina > 1 ? <Link href={url(pagina - 1)} className={clase}><ChevronLeft className="h-4 w-4" aria-hidden /> Anterior</Link> : <span className={`${clase} pointer-events-none opacity-40`}><ChevronLeft className="h-4 w-4" aria-hidden /> Anterior</span>}
        {pagina < paginas ? <Link href={url(pagina + 1)} className={clase}>Siguiente <ChevronRight className="h-4 w-4" aria-hidden /></Link> : <span className={`${clase} pointer-events-none opacity-40`}>Siguiente <ChevronRight className="h-4 w-4" aria-hidden /></span>}
      </div>
    </nav>
  );
}
