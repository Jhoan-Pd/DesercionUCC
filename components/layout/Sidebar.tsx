"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETA_ROL, type Rol } from "@/lib/roles";
import type { Modulo } from "@/lib/modulos";
import { IconoModulo } from "./Iconos";

interface Props {
  modulos: Modulo[];
  usuario: { nombre: string; email: string; rol: Rol };
}

/** Navegación lateral (escritorio) con menú desplegable en móvil */
export function Sidebar({ modulos, usuario }: Props) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const contenido = (
    <div className="flex h-full flex-col bg-ucc-azul-oscuro text-white">
      <div className="flex items-center gap-3 py-5 pl-5 pr-12 lg:pr-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
          <GraduationCap className="h-6 w-6" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold">Observatorio de Deserción</p>
          <p className="text-xs text-white/70">UCC · Sede Pasto</p>
        </div>
      </div>

      <nav aria-label="Módulos" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {modulos.map((m) => {
          const activo = pathname === m.href || pathname.startsWith(`${m.href}/`);
          return (
            <Link
              key={m.href}
              href={m.href}
              onClick={() => setAbierto(false)}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                activo ? "bg-white/15 font-semibold" : "text-white/85 hover:bg-white/10",
              )}
            >
              <IconoModulo icono={m.icono} className="h-4 w-4 shrink-0" />
              <span className="flex-1">{m.titulo}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/15 p-4">
        <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
        <p className="truncate text-xs text-white/70">{usuario.email}</p>
        <p className="mt-1 inline-block rounded bg-ucc-verde px-2 py-0.5 text-[11px] font-semibold">{ETIQUETA_ROL[usuario.rol]}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-white/85 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Barra superior en móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ucc-azul-oscuro px-4 py-3 text-white lg:hidden">
        <span className="flex items-center gap-2 text-sm font-bold">
          <GraduationCap className="h-5 w-5" aria-hidden /> Observatorio de Deserción
        </span>
        <button onClick={() => setAbierto(true)} aria-label="Abrir menú" className="rounded p-1 hover:bg-white/10">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Panel fijo en escritorio */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 lg:block">{contenido}</aside>

      {/* Cajón móvil */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
            <button onClick={() => setAbierto(false)} aria-label="Cerrar menú" className="absolute right-3 top-3 z-10 rounded p-1 text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
            {contenido}
          </div>
        </div>
      )}
    </>
  );
}
