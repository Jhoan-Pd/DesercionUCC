/** Estado vacío: se muestra cuando no hay datos reales (nunca se rellena con datos de ejemplo) */
export function Vacio({ titulo, children, accion }: { titulo: string; children?: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-tinta/20 bg-card px-6 py-12 sm:px-10">
      <p className="meta">{"// sin datos todavía"}</p>
      <h2 className="titulo-serif text-[30px] sm:text-[34px]">{titulo}</h2>
      {children && <div className="max-w-xl text-[15px] leading-relaxed text-grafito">{children}</div>}
      {accion}
    </div>
  );
}
