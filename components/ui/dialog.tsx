"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Diálogo modal accesible (role="dialog", aria-modal, cierre con Escape y clic fuera,
 * foco inicial dentro del diálogo y retorno del foco al cerrar).
 */
export function Dialog({ abierto, onCerrar, titulo, descripcion, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDesc = useId();

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    const enfocable = ref.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-cerrar])");
    enfocable?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      previo?.focus();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={onCerrar} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDesc : undefined}
        className={cn("relative z-10 w-full max-w-lg rounded-t-xl bg-card p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:rounded-xl", className)}
      >
        <button data-cerrar onClick={onCerrar} aria-label="Cerrar" className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
        <h2 id={idTitulo} className="titulo-serif pr-8 text-[28px]">{titulo}</h2>
        {descripcion && <p id={idDesc} className="mt-2 text-sm text-grafito">{descripcion}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
