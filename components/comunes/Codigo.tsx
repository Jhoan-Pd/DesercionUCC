/**
 * Texto con forma de etiqueta HTML («<p>…</p>»), en monoespaciada y con colores de sintaxis.
 * Es un recurso tipográfico del diseño editorial: el contenido sigue siendo texto normal y accesible.
 */
export function EtiquetaCodigo({ etiqueta, atributo, children }: { etiqueta: string; atributo?: { nombre: string; valor: string }; children: React.ReactNode }) {
  return (
    <p className="font-mono text-[13px] leading-[1.85] tracking-[0.03em] text-grafito">
      <span aria-hidden>
        <span className="text-petroleo">&lt;</span>
        <span className="text-coral">{etiqueta}</span>
        {atributo && (
          <>
            {" "}
            <span className="text-marino">{atributo.nombre}</span>
            <span className="text-petroleo">=</span>
            <span className="text-pino">&quot;{atributo.valor}&quot;</span>
          </>
        )}
        <span className="text-petroleo">&gt;</span>
      </span>
      {children}
      <span aria-hidden>
        <span className="text-petroleo">&lt;/</span>
        <span className="text-coral">{etiqueta}</span>
        <span className="text-petroleo">&gt;</span>
      </span>
    </p>
  );
}
