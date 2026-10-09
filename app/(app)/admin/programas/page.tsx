import { ServicioCatalogos } from "@/services/admin/ServicioCatalogos";
import { GestorProgramas } from "@/components/admin/GestorProgramas";
import { MigaAdmin } from "@/components/admin/MigaAdmin";

export const metadata = { title: "Programas" };
export const dynamic = "force-dynamic";

export default async function ProgramasPage() {
  const programas = await new ServicioCatalogos().listarProgramas();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <MigaAdmin actual="Programas" />
        <h1 className="text-2xl font-bold tracking-tight">Programas académicos</h1>
        <p className="max-w-3xl text-muted-foreground">Duración, valor de la matrícula y salario de enganche de cada programa. Un programa con estudiantes no se elimina: se desactiva.</p>
      </header>
      <GestorProgramas programas={programas} />
    </div>
  );
}
