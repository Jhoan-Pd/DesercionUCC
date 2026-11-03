import Link from "next/link";

/** Barra de las páginas públicas (portada, datos abiertos e inicio de sesión) */
export function CabeceraPublica({ enlaces = true }: { enlaces?: boolean }) {
  return (
    <header className="border-b bg-papel">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="whitespace-nowrap text-[14px] uppercase tracking-[0.14em] text-tinta sm:text-[15px]">
          Observatorio <span aria-hidden className="mx-2">•</span> UCC Pasto
        </Link>
        {enlaces && (
          <nav aria-label="Secciones públicas" className="flex items-center gap-6 text-[12px] uppercase tracking-[0.12em] text-grafito">
            <Link href="/datos-abiertos" className="hidden transition-colors hover:text-tinta sm:inline">
              Cifras oficiales
            </Link>
            <Link href="/inicio" className="rounded-sm bg-tinta px-4 py-2 text-white transition-colors hover:bg-grafito">
              Entrar
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
