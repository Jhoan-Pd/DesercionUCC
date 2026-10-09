import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ServicioDocente, UMBRAL_INASISTENCIA, UMBRAL_NOTA_BAJA } from "@/services/docente/ServicioDocente";
import { PanelDocente } from "@/components/docente/PanelDocente";

export const metadata = { title: "Panel docente" };
export const dynamic = "force-dynamic";

export default async function PanelDocentePage({ searchParams }: { searchParams: { docenteId?: string } }) {
  const session = (await getServerSession(authOptions))!;
  const docenteId = z.string().uuid().safeParse(searchParams.docenteId);
  const datos = await new ServicioDocente().cursos({ id: session.user.id, rol: session.user.rol }, docenteId.success ? docenteId.data : undefined);
  const total = datos.cursos.reduce((a, c) => a + c.estudiantes.length, 0);
  const conSenales = datos.cursos.reduce((a, c) => a + c.conSenales, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Panel docente</h1>
        <p className="max-w-3xl text-muted-foreground">
          Periodo {datos.periodo ?? "—"} · {datos.cursos.length} cursos · {total} inscripciones · <b className="text-foreground">{conSenales} con bajo rendimiento o inasistencia</b>. Si un estudiante te preocupa, repórtalo: Bienestar Universitario hará el seguimiento.
        </p>
      </header>
      <PanelDocente
        key={docenteId.success ? docenteId.data : "propio"}
        cursos={datos.cursos}
        docentes={datos.docentes}
        docenteSeleccionado={docenteId.success ? docenteId.data : undefined}
        umbrales={{ nota: UMBRAL_NOTA_BAJA, asistencia: UMBRAL_INASISTENCIA }}
      />
      <p className="text-xs text-muted-foreground">Solo ves información académica de tus cursos. Los datos personales y el puntaje de riesgo los maneja Bienestar (Ley 1581 de 2012).</p>
    </div>
  );
}
