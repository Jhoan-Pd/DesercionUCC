import { Skeleton } from "@/components/ui/skeleton";

export default function Cargando() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando alerta temprana">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-20" />
      <Skeleton className="h-[480px]" />
    </div>
  );
}
