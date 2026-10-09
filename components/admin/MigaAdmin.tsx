import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Migas de pan de las páginas de administración */
export function MigaAdmin({ actual }: { actual: string }) {
  return (
    <nav aria-label="Ruta" className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/admin" className="hover:text-primary hover:underline">Administración</Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      <span aria-current="page" className="text-foreground">{actual}</span>
    </nav>
  );
}
