import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center gap-6 px-4 sm:px-6 lg:px-8">
      <p className="meta">{"// error 404"}</p>
      <h1 className="titulo-serif text-[52px] sm:text-[72px]">esta página no existe.</h1>
      <p className="max-w-lg text-[15px] text-grafito">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <Link href="/" className={`${buttonVariants()} w-fit`}>
        Volver al inicio
      </Link>
    </main>
  );
}
