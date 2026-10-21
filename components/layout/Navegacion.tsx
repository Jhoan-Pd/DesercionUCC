"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETA_ROL, type Rol } from "@/lib/roles";
import type { Modulo } from "@/lib/modulos";

interface Props {
  modulos: Modulo[];
  usuario: { nombre: string; email: string; rol: Rol };
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "U";
}

/** Menú de la cuenta: iniciales con flecha; al abrirlo muestra el nombre, el rol y «Cerrar sesión» */
function MenuCuenta({ usuario }: { usuario: Props["usuario"] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={`Cuenta de ${usuario.nombre}`}
        className="flex items-center gap-1 rounded-full p-0.5 text-piedra transition-colors hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hoja text-[11px] font-semibold tracking-wider text-pino">
          {iniciales(usuario.nombre)}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} aria-hidden />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-3 w-64 rounded-lg border bg-card p-4 shadow-suave">
          <p className="truncate text-sm font-semibold text-tinta">{usuario.nombre}</p>
          <p className="meta truncate">{usuario.email}</p>
          <p className="mt-3 inline-block rounded-sm bg-hoja px-2 py-0.5 text-[11px] font-semibold uppercase tracking-ceja text-pino">
            {ETIQUETA_ROL[usuario.rol]}
          </p>
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-4 flex w-full items-center gap-2 border-t pt-3 text-sm text-grafito transition-colors hover:text-tinta"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Barra superior editorial: marca en versalitas, secciones en mayúsculas espaciadas y la
 * sección activa entre corchetes («[ INICIO ]»). En móvil la marca va arriba y las secciones
 * se desplazan horizontalmente debajo.
 */
export function Navegacion({ modulos, usuario }: Props) {
  const pathname = usePathname();
  const navMovil = useRef<HTMLElement>(null);

  // En móvil, la sección activa puede quedar fuera de la vista: se desplaza la barra hasta ella
  useEffect(() => {
    navMovil.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const marca = (
    <Link href="/inicio" className="whitespace-nowrap text-[14px] uppercase tracking-[0.14em] text-tinta sm:text-[15px]">
      Observatorio <span aria-hidden>•</span> UCC Pasto
    </Link>
  );

  const enlaces = modulos.map((m) => {
    const activo = pathname === m.href || pathname.startsWith(`${m.href}/`);
    return (
      <Link
        key={m.href}
        href={m.href}
        aria-current={activo ? "page" : undefined}
        className={cn(
          "whitespace-nowrap px-1 py-2 text-[13px] uppercase tracking-[0.12em] transition-colors",
          activo ? "font-semibold text-tinta" : "text-piedra hover:text-tinta",
        )}
      >
        {activo && <span aria-hidden>[ </span>}
        {m.corto}
        {activo && <span aria-hidden> ]</span>}
      </Link>
    );
  });

  return (
    <header className="sticky top-0 z-30 border-b bg-papel/95 backdrop-blur supports-[backdrop-filter]:bg-papel/85">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Escritorio: marca a la izquierda, secciones y cuenta a la derecha */}
        <div className="hidden h-[72px] items-center justify-between gap-8 lg:flex">
          {marca}
          <div className="flex items-center gap-8">
            <nav aria-label="Secciones" className="flex items-center gap-7">
              {enlaces}
            </nav>
            <MenuCuenta usuario={usuario} />
          </div>
        </div>

        {/* Móvil y tableta: marca y cuenta arriba, secciones desplazables debajo */}
        <div className="lg:hidden">
          <div className="flex h-14 items-center justify-between gap-4">
            {marca}
            <MenuCuenta usuario={usuario} />
          </div>
          <nav ref={navMovil} aria-label="Secciones" className="sin-barra -mx-4 flex gap-6 overflow-x-auto px-4 pb-2">
            {enlaces}
          </nav>
        </div>
      </div>
    </header>
  );
}
