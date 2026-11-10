import { ServicioAgente } from "@/services/agente/ServicioAgente";
import { Encabezado } from "@/components/comunes/Encabezado";
import { ChatAgente } from "@/components/agente/ChatAgente";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Agente IA" };
export const dynamic = "force-dynamic";

export default function AgentePage() {
  const disponible = new ServicioAgente().disponible;
  return (
    <>
      <Encabezado
        seccion="/agente"
        titulo="pregúntale al agente."
        descripcion="Asistente de IA (Groq, con Google Gemini de respaldo) que consulta los estudiantes cargados y las cifras oficiales para ayudarte a priorizar a quién acompañar. Nunca inventa datos: responde solo con lo que hay en el sistema."
      />
      {disponible ? (
        <ChatAgente />
      ) : (
        <Alert variant="warning" titulo="El agente no está configurado">
          Falta la variable de entorno <code className="rounded-sm bg-white/70 px-1 font-mono text-[13px]">GROQ_API_KEY</code> (o{" "}
          <code className="rounded-sm bg-white/70 px-1 font-mono text-[13px]">GEMINI_API_KEY</code>) en el servidor. Crea una clave gratuita en console.groq.com y agrégala en Vercel
          (Settings → Environment Variables). El resto del sistema funciona sin ella: el riesgo y las explicaciones básicas se calculan igual.
        </Alert>
      )}
    </>
  );
}
