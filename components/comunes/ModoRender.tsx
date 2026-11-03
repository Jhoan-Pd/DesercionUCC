import { formatoFechaHora } from "@/lib/formato";

/**
 * Patrón de rendering de cada página, visible al pie (recurso didáctico de la asignatura).
 * La hora que se muestra es la del momento en que el SERVIDOR generó el HTML: en una página SSG es
 * la hora del build, en una ISR la de la última regeneración y en una SSR la de esta misma petición.
 */
export type Modo = "SSG" | "ISR" | "SSR";

const MODOS: Readonly<Record<Modo, { nombre: string; cuando: string }>> = {
  SSG: { nombre: "generación estática (SSG)", cuando: "generada en el build" },
  ISR: { nombre: "regeneración estática incremental (ISR)", cuando: "generada" },
  SSR: { nombre: "renderizado en el servidor por petición (SSR)", cuando: "generada para tu sesión" },
};

export function ModoRender({ modo, detalle, generadaEn = new Date() }: { modo: Modo; detalle?: string; generadaEn?: Date }) {
  const m = MODOS[modo];
  return (
    <p className="meta" data-modo-render={modo}>
      {`// ${m.nombre} · ${m.cuando} el ${formatoFechaHora(generadaEn)}`}
      {detalle ? ` · ${detalle}` : ""}
    </p>
  );
}
