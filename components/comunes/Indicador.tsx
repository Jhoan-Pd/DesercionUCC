import { cn } from "@/lib/utils";

/** Cifra destacada (sin gráfica): etiqueta, valor y nota opcional */
export function Indicador({ etiqueta, valor, nota, icono, className }: { etiqueta: string; valor: string; nota?: React.ReactNode; icono?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icono}
        {etiqueta}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{valor}</p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}
