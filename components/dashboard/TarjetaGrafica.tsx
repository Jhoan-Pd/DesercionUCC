"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface TablaDatos {
  columnas: string[];
  filas: (string | number)[][];
}

interface Props {
  titulo: string;
  descripcion?: string;
  /** Texto auxiliar bajo la gráfica (p. ej. advertencia metodológica) */
  nota?: string;
  tabla: TablaDatos;
  /** Si no hay datos se muestra un mensaje en lugar de la gráfica */
  vacio?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Contenedor de cada gráfica: título, descripción, vista alternativa en TABLA
 * (accesibilidad: la información no depende solo del color) y estado vacío.
 */
export function TarjetaGrafica({ titulo, descripcion, nota, tabla, vacio, className, children }: Props) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>{titulo}</CardTitle>
          {descripcion && <CardDescription>{descripcion}</CardDescription>}
        </div>
        {!vacio && (
          <button
            onClick={() => setVerTabla((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            aria-pressed={verTabla}
          >
            {verTabla ? <BarChart3 className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
            {verTabla ? "Ver gráfica" : "Ver tabla"}
          </button>
        )}
      </CardHeader>
      <CardContent>
        {vacio ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No hay datos para los filtros seleccionados.</p>
        ) : verTabla ? (
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <THead>
                <TR>{tabla.columnas.map((c) => <TH key={c}>{c}</TH>)}</TR>
              </THead>
              <TBody>
                {tabla.filas.map((fila, i) => (
                  <TR key={i}>{fila.map((celda, j) => <TD key={j}>{typeof celda === "number" ? celda.toLocaleString("es-CO") : celda}</TD>)}</TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : (
          children
        )}
        {nota && !verTabla && !vacio && <p className="mt-3 text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}
