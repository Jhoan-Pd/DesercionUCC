import { ServicioModelo } from "@/services/riesgo/ServicioModelo";
import { GestorModelo } from "@/components/admin/GestorModelo";
import { MigaAdmin } from "@/components/admin/MigaAdmin";

export const metadata = { title: "Modelo de riesgo" };
export const dynamic = "force-dynamic";

export default async function ModeloPage() {
  const resumen = await new ServicioModelo().listar();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <MigaAdmin actual="Modelo de riesgo" />
        <h1 className="text-2xl font-bold tracking-tight">Modelo de riesgo: versiones y reentrenamiento</h1>
        <p className="max-w-3xl text-muted-foreground">
          Regresión logística entrenada originalmente en Python (scikit-learn). Desde aquí se puede reentrenar en el servidor con los datos actuales, comparar contra la versión activa y decidir cuál usar, sin desplegar de nuevo la aplicación.
        </p>
      </header>
      <GestorModelo resumen={resumen} />
    </div>
  );
}
