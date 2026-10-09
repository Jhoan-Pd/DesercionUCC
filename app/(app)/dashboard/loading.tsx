import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoDashboard() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96" />)}
      </div>
    </div>
  );
}
