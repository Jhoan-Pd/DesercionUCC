import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Acceso denegado" };

export default function AccesoDenegado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center gap-6 px-4 sm:px-6 lg:px-8">
      <p className="meta">{"// error 403"}</p>
      <h1 className="titulo-serif text-[52px] sm:text-[72px]">esta sección no es para tu rol.</h1>
      <p className="max-w-lg text-[15px] text-grafito">
        Tu rol no tiene permiso para ver esta sección. Los datos individuales de estudiantes están protegidos por la Ley 1581 de 2012 (habeas data). Si necesitas acceso, pídeselo al
        administrador.
      </p>
      <Link href="/" className={`${buttonVariants()} w-fit`}>
        Volver a mi inicio
      </Link>
    </main>
  );
}
