import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ErrorApi } from "@/lib/api";
import { ServicioImpacto, type PerfilImpacto } from "@/services/impacto/ServicioImpacto";
import { CalculadoraImpactoForm } from "@/components/calculadora/CalculadoraImpactoForm";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Calculadora de impacto" };
export const dynamic = "force-dynamic";

export default async function CalculadoraPage({ searchParams }: { searchParams: { codigo?: string } }) {
  const session = (await getServerSession(authOptions))!; // el layout ya validó la sesión
  const { rol, estudianteId, id } = session.user;
  const servicio = new ServicioImpacto();

  // Un estudiante arranca con SU perfil; los demás roles con los valores por defecto del primer programa
  // Bienestar/Admin pueden llegar desde la ficha de alerta temprana con ?codigo=
  const codigo = typeof searchParams.codigo === "string" ? searchParams.codigo.trim().slice(0, 30) : "";
  let avisoCodigo: string | null = null;
  let perfil: PerfilImpacto;
  if (rol === "ESTUDIANTE" && estudianteId) {
    perfil = await servicio.perfilPorEstudiante({ estudianteId }, { rol, estudianteId, usuarioId: id });
  } else if (codigo && (rol === "ADMIN" || rol === "BIENESTAR")) {
    try {
      perfil = await servicio.perfilPorEstudiante({ codigo }, { rol, estudianteId, usuarioId: id });
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      avisoCodigo = `No se encontró el estudiante con código ${codigo}. Se muestran valores generales.`;
      perfil = await servicio.perfilPorPrograma();
    }
  } else {
    perfil = await servicio.perfilPorPrograma();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Calculadora de impacto: ¿qué pasa si me retiro?</h1>
        <p className="max-w-3xl text-muted-foreground">
          Antes de tomar la decisión, mira cuánto has invertido, qué deuda quedaría y cuánto dejarías de ganar en 10, 20 y 30 años. También puedes comparar alternativas: aplazar, cambiar de jornada o pedir apoyo financiero.
        </p>
      </header>
      <Alert variant="info">
        Los resultados son estimaciones con supuestos de salarios y costos editables por la universidad. Si estás pensando en retirarte, Bienestar Universitario puede acompañarte antes de decidir.
      </Alert>
      {avisoCodigo && <Alert variant="warning">{avisoCodigo}</Alert>}
      <CalculadoraImpactoForm perfilInicial={perfil} rol={rol} />
    </div>
  );
}
