import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoInstitucional() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando impacto institucional">
      <Skeleton className="h-8 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      <Skeleton className="h-56" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-80" />)}</div>
    </div>
  );
}
