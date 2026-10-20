import { cn } from "@/lib/utils";

/** Cifra destacada (sin gráfica): etiqueta en versalitas, valor en serif y nota opcional */
export function Indicador({ etiqueta, valor, nota, icono, className }: { etiqueta: string; valor: string; nota?: React.ReactNode; icono?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-ceja text-grafito">
        {icono}
        {etiqueta}
      </p>
      <p className="mt-3 font-serif text-[44px] font-semibold leading-none lining-nums tabular-nums tracking-[-0.01em] text-tinta">{valor}</p>
      {nota && <p className="mt-2 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}
