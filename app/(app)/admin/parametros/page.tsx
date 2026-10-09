import { ServicioParametros } from "@/services/parametros/ServicioParametros";
import { EditorParametros } from "@/components/admin/EditorParametros";

export const metadata = { title: "Parámetros" };
export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const parametros = await new ServicioParametros().listar();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Parámetros económicos y de referencia</h1>
        <p className="max-w-3xl text-muted-foreground">
          Salarios de referencia (Observatorio Laboral para la Educación), costos, tasas, supuestos de escenarios y valores nacionales de SPADIES. Los cambios se aplican de inmediato en la calculadora y el dashboard.
        </p>
      </header>
      <EditorParametros inicial={parametros} />
    </div>
  );
}
