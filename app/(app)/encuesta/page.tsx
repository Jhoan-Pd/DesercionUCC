import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ServicioEncuesta } from "@/services/encuesta/ServicioEncuesta";
import { Alert } from "@/components/ui/alert";
import { FormularioEncuesta } from "@/components/encuesta/FormularioEncuesta";
import { ResultadoEncuestaVista } from "@/components/encuesta/ResultadoEncuestaVista";

export const metadata = { title: "Encuesta de autoevaluación" };
export const dynamic = "force-dynamic";

export default async function EncuestaPage() {
  const session = (await getServerSession(authOptions))!;
  const historial = await new ServicioEncuesta().historial(session.user.estudianteId);
  const ultima = historial[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Encuesta de autoevaluación</h1>
        <p className="text-muted-foreground">
          Responde con sinceridad: no hay respuestas correctas. Al final verás tu nivel de riesgo y los recursos que la universidad tiene para ti.
        </p>
      </header>
      {!session.user.estudianteId ? (
        <Alert variant="warning">Tu usuario no está asociado a un registro de estudiante. Contacta al administrador.</Alert>
      ) : (
        <>
          <FormularioEncuesta />
          {ultima && (
            <section className="space-y-3 border-t pt-6">
              <h2 className="text-lg font-semibold">Tu respuesta anterior</h2>
              <ResultadoEncuestaVista
                fecha={ultima.fecha}
                autorizaContacto={ultima.autorizaContacto}
                resultado={{ puntaje: ultima.puntaje, nivel: ultima.nivel, puntajesDimension: ultima.puntajesDimension, recursos: ultima.recursos }}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
