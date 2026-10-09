import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoIntervenciones() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando intervenciones">
      <Skeleton className="h-8 w-80" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-96" />
    </div>
  );
}
