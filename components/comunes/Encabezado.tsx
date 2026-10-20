import { cejaDe } from "@/lib/modulos";

/** Ceja de sección: «[01] INICIO» con un filete corto debajo */
export function Ceja({ numero, children }: { numero?: string; children: React.ReactNode }) {
  return (
    <p className="ceja inline-block border-b border-tinta/25 pb-3 pr-6">
      {numero && <span className="mr-2 text-salvia">[{numero}]</span>}
      {children}
    </p>
  );
}

/**
 * Encabezado de página editorial: ceja con el número y el nombre de la sección, título en serif
 * (frase corta en minúsculas que termina en punto) y descripción. `seccion` es la ruta del menú.
 */
export function Encabezado({
  seccion,
  ceja,
  titulo,
  descripcion,
  children,
}: {
  seccion?: string;
  /** Texto de la ceja cuando no corresponde a una sección del menú (p. ej. «Ficha del estudiante») */
  ceja?: string;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const s = seccion ? cejaDe(seccion) : null;
  return (
    <header className="space-y-7">
      {(s || ceja) && (
        <Ceja numero={s?.numero}>
          {s?.nombre}
          {s && ceja && <span className="mx-2 text-salvia">→</span>}
          {ceja}
        </Ceja>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl space-y-4">
          <h1 className="titulo-serif text-[40px] sm:text-[52px]">{titulo}</h1>
          {descripcion && <div className="text-[15px] leading-relaxed text-grafito">{descripcion}</div>}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </header>
  );
}

/** Título de bloque dentro de una página (serif, más pequeño que el de la página) */
export function TituloBloque({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`titulo-serif text-[28px] sm:text-[32px] ${className ?? ""}`}>{children}</h2>;
}
