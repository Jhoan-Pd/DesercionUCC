import { CabeceraPublica } from "@/components/layout/CabeceraPublica";

/**
 * Layout de las páginas públicas. A diferencia del layout del observatorio, NO lee la sesión ni las
 * cabeceras de la petición: por eso sus páginas pueden generarse estáticamente (SSG o ISR) y servirse
 * desde la CDN sin pasar por el servidor. No muestran ningún dato de estudiantes.
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <CabeceraPublica />
      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-10 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">{children}</main>
      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-10 sm:px-6 lg:px-8">
        <p className="meta border-t pt-6">{"// "}Proyecto final · Programación Orientada a la Web · Universidad Cooperativa de Colombia, sede Pasto</p>
      </footer>
    </div>
  );
}
