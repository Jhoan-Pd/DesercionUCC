import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { GraduationCap } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { rutaInicial } from "@/lib/rbac";
import { FormularioLogin } from "@/components/layout/FormularioLogin";

export const metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  const session = await getServerSession(authOptions);
  if (session) redirect(rutaInicial(session.user.rol));

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-ucc-azul-oscuro to-ucc-azul p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" aria-hidden />
          <span className="text-lg font-semibold">Universidad Cooperativa de Colombia · Pasto</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">Observatorio de Deserción</h1>
          <p className="max-w-md text-lg text-white/85">
            Mide el impacto de desertar, detecta a tiempo a los estudiantes en riesgo y evalúa si las intervenciones funcionan.
          </p>
          <div className="h-1 w-24 rounded bg-ucc-verde" />
        </div>
        <p className="text-sm text-white/70">Proyecto final · Programación Orientada a la Web</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-2xl font-bold">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">Ingresa con tu correo institucional.</p>
          </div>
          <FormularioLogin callbackUrl={searchParams.callbackUrl} />
          <p className="text-xs text-muted-foreground">
            Tus datos se tratan conforme a la Ley 1581 de 2012 (habeas data). Solo el personal autorizado puede ver información individual.
          </p>
        </div>
      </section>
    </main>
  );
}
