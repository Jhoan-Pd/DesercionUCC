import { ServicioCatalogos } from "@/services/admin/ServicioCatalogos";
import { GestorPeriodos } from "@/components/admin/GestorPeriodos";
import { MigaAdmin } from "@/components/admin/MigaAdmin";

export const metadata = { title: "Periodos" };
export const dynamic = "force-dynamic";

export default async function PeriodosPage() {
  const periodos = await new ServicioCatalogos().listarPeriodos();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <MigaAdmin actual="Periodos" />
        <h1 className="text-2xl font-bold tracking-tight">Periodos académicos</h1>
        <p className="max-w-3xl text-muted-foreground">Solo un periodo puede estar activo: es el semestre en curso para el dashboard, la alerta temprana y el panel docente.</p>
      </header>
      <GestorPeriodos periodos={periodos} />
    </div>
  );
}
