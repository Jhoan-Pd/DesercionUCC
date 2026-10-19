import { Inbox } from "lucide-react";

/** Estado vacío: se muestra cuando no hay datos reales (nunca se rellena con datos de ejemplo) */
export function Vacio({ titulo, children, accion }: { titulo: string; children?: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-12 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {children && <div className="max-w-lg text-sm text-muted-foreground">{children}</div>}
      {accion}
    </div>
  );
}
