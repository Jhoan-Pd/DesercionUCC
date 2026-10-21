import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rutaInicial } from "@/lib/rbac";
import { FormularioLogin } from "@/components/layout/FormularioLogin";
import { EtiquetaCodigo } from "@/components/comunes/Codigo";
import { Ceja } from "@/components/comunes/Encabezado";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; motivo?: string } }) {
  const session = await getServerSession(authOptions);
  // Una sesión revocada (cuenta desactivada) no redirige: se muestra el aviso y se puede entrar con otra cuenta
  if (session && !session.revocada) redirect(rutaInicial(session.user.rol));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-white/95 shadow-suave">
        <p className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-center px-4 text-[14px] uppercase tracking-[0.14em] text-tinta sm:text-[15px] lg:justify-start lg:px-8">
          Observatorio <span aria-hidden className="mx-2">•</span> UCC Pasto
        </p>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:gap-20 lg:px-8 lg:py-20">
        <section className="space-y-8">
          <h1 className="titulo-serif text-[52px] sm:text-[72px] lg:text-[84px]">
            observatorio
            <br />
            de deserción.
          </h1>
          <div className="max-w-xl space-y-3">
            <EtiquetaCodigo etiqueta="p">
              Detecta a tiempo a los estudiantes que podrían retirarse, con datos reales de la universidad y un agente de IA que explica cada caso a Bienestar.
            </EtiquetaCodigo>
            <EtiquetaCodigo etiqueta="output" atributo={{ nombre: "name", valor: "sede" }}>
              Universidad Cooperativa de Colombia, Pasto.
            </EtiquetaCodigo>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6 sm:p-8">
          <div className="space-y-6">
            <Ceja>Acceso</Ceja>
            <div className="space-y-2">
              <h2 className="titulo-serif text-[34px]">iniciar sesión.</h2>
              <p className="text-sm text-grafito">Ingresa con tu correo institucional.</p>
            </div>
            {(searchParams.motivo === "cuenta-desactivada" || session?.revocada) && (
              <Alert variant="warning" titulo="Tu sesión se cerró">
                La cuenta fue desactivada por el administrador. Si crees que es un error, comunícate con el administrador del observatorio.
              </Alert>
            )}
            <FormularioLogin callbackUrl={searchParams.callbackUrl} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tus datos se tratan conforme a la Ley 1581 de 2012 (habeas data). Solo el personal autorizado puede ver información individual.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-10 sm:px-6 lg:px-8">
        <p className="meta border-t pt-6">{"// "}Proyecto final · Programación Orientada a la Web</p>
      </footer>
    </div>
  );
}
