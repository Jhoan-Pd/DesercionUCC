import Link from "next/link";
import { ArrowRight, Bot, Database, ShieldCheck } from "lucide-react";
import { resumenUccPasto } from "@/lib/datos-abiertos";
import { formatoNumero } from "@/lib/formato";
import { EtiquetaCodigo } from "@/components/comunes/Codigo";
import { Ceja } from "@/components/comunes/Encabezado";
import { ModoRender } from "@/components/comunes/ModoRender";
import { buttonVariants } from "@/components/ui/button";

/**
 * Portada pública con generación estática (SSG): el HTML se genera UNA vez en el build y se sirve
 * igual a todos desde la CDN, sin consultar la base de datos ni la sesión. «Entrar» lleva a /inicio,
 * que pide iniciar sesión si hace falta (antes la raíz leía la sesión en cada visita solo para redirigir).
 */
export const dynamic = "force-static";

const PILARES = [
  { icono: Database, titulo: "datos reales.", texto: "La universidad carga su archivo de estudiantes. Si un dato no viene, no se usa ni se inventa." },
  { icono: ShieldCheck, titulo: "riesgo explicado.", texto: "Puntaje por factores del MEN-SPADIES o un modelo entrenado con estudiantes de la UCC que ya se retiraron o se graduaron." },
  { icono: Bot, titulo: "un agente que ayuda.", texto: "Gemini explica cada caso y sugiere acciones de Bienestar, sin recibir nunca nombres ni documentos." },
] as const;

export default function Portada() {
  // Cifra oficial del respaldo de datos.gov.co, calculada en el build
  const r = resumenUccPasto();

  return (
    <>
      <section className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
        <div className="space-y-8">
          <Ceja numero="00">Observatorio de deserción</Ceja>
          <h1 className="titulo-serif text-[52px] sm:text-[72px] lg:text-[84px]">
            detectar a tiempo,
            <br />
            acompañar mejor.
          </h1>
          <div className="max-w-xl space-y-3">
            <EtiquetaCodigo etiqueta="p">Identifica a los estudiantes que podrían retirarse de la UCC Pasto para que Bienestar Universitario los acompañe antes de que sea tarde.</EtiquetaCodigo>
            <EtiquetaCodigo etiqueta="output" atributo={{ nombre: "name", valor: "acceso" }}>
              Solo personal autorizado: Administración y Bienestar.
            </EtiquetaCodigo>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/inicio" className={buttonVariants()}>
              Entrar al observatorio <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/datos-abiertos" className={buttonVariants({ variant: "outline" })}>
              Ver cifras oficiales
            </Link>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-ceja text-grafito">Sede Pasto · {r.ultimo.anio}</p>
          <p className="mt-3 font-serif text-[64px] font-semibold leading-none lining-nums tabular-nums text-tinta">{formatoNumero(r.ultimo.total)}</p>
          <p className="mt-2 text-sm text-grafito">matriculados según el Ministerio de Educación, en {r.programas.length} programas.</p>
          <p className="meta mt-4">{"// "}datos.gov.co · cifra agregada, sin datos personales</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="titulo-serif text-[34px]">cómo funciona.</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {PILARES.map(({ icono: Icono, titulo, texto }) => (
            <div key={titulo} className="space-y-3 rounded-xl border bg-card p-6">
              <Icono className="h-5 w-5 text-petroleo" aria-hidden />
              <h3 className="titulo-serif text-[26px]">{titulo}</h3>
              <p className="text-sm text-grafito">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <ModoRender modo="SSG" detalle="servida igual a todos desde la CDN, sin base de datos ni sesión" />
    </>
  );
}
