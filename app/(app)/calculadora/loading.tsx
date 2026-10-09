import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoCalculadora() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando calculadora">
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
