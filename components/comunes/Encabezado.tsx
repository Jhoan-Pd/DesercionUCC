/** Título de página con descripción y acciones opcionales a la derecha */
export function Encabezado({ titulo, descripcion, children }: { titulo: string; descripcion?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descripcion && <p className="max-w-3xl text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}
