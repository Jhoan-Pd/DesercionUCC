"use client";

import { useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ParametroDTO } from "@/services/parametros/ServicioParametros";

const TITULOS: Record<string, { titulo: string; descripcion: string }> = {
  SALARIO: { titulo: "Salarios de referencia (OLE)", descripcion: "Ingresos de enganche por nivel educativo y por programa; crecimiento y tasa de descuento." },
  COSTO: { titulo: "Costos del estudiante", descripcion: "Transporte, materiales y sostenimiento usados como valores por defecto." },
  FINANCIERO: { titulo: "Financiación", descripcion: "Tasas y plazos de referencia de ICETEX y crédito UCC." },
  ESCENARIO: { titulo: "Supuestos de escenarios", descripcion: "Parámetros de aplazar, jornada nocturna/virtual y apoyo financiero." },
  SPADIES: { titulo: "Referencias nacionales (SPADIES)", descripcion: "Deserción anual y curva por cohorte del Ministerio de Educación; distribución de causas." },
};
const ORDEN = ["SALARIO", "COSTO", "FINANCIERO", "ESCENARIO", "SPADIES"];

export function EditorParametros({ inicial }: { inicial: ParametroDTO[] }) {
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(inicial.map((p) => [p.id, String(p.valor)])));
  const [guardados, setGuardados] = useState<Record<string, number>>(() => Object.fromEntries(inicial.map((p) => [p.id, p.valor])));
  const [estado, setEstado] = useState<{ tipo: "success" | "error"; mensaje: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambios = useMemo(
    () => inicial.filter((p) => valores[p.id] !== "" && Number(valores[p.id]) !== guardados[p.id]),
    [inicial, valores, guardados],
  );
  const invalidos = inicial.filter((p) => valores[p.id] === "" || !Number.isFinite(Number(valores[p.id])) || Number(valores[p.id]) < 0);

  async function guardar() {
    setEstado(null);
    setGuardando(true);
    try {
      const res = await fetch("/api/parametros", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cambios: cambios.map((p) => ({ id: p.id, valor: Number(valores[p.id]) })) }),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error ?? "No se pudieron guardar los cambios.");
      setGuardados((g) => ({ ...g, ...Object.fromEntries(cambios.map((p) => [p.id, Number(valores[p.id])])) }));
      setEstado({ tipo: "success", mensaje: `Se actualizaron ${cuerpo.actualizados} parámetro(s).` });
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "Error inesperado." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      {estado && <Alert variant={estado.tipo}>{estado.mensaje}</Alert>}
      {invalidos.length > 0 && <Alert variant="warning">Hay {invalidos.length} valor(es) vacíos o inválidos; corrígelos antes de guardar.</Alert>}

      {ORDEN.map((cat) => {
        const filas = inicial.filter((p) => p.categoria === cat);
        if (filas.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle>{TITULOS[cat].titulo}</CardTitle>
              <CardDescription>{TITULOS[cat].descripcion}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {filas.map((p) => {
                const modificado = Number(valores[p.id]) !== guardados[p.id];
                return (
                  <div key={p.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_220px] sm:items-center">
                    <div>
                      <label htmlFor={p.id} className="text-sm font-medium">{p.nombre}</label>
                      <p className="text-xs text-muted-foreground">
                        {p.programaNombre && <span className="mr-1 rounded bg-secondary px-1.5 py-0.5 font-medium">{p.programaNombre}</span>}
                        {p.descripcion}
                        {p.fuente && <span className="block">Fuente: {p.fuente}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={p.id}
                        type="number"
                        min={0}
                        step="any"
                        value={valores[p.id]}
                        onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value }))}
                        className={modificado ? "border-primary ring-1 ring-primary" : undefined}
                      />
                      <span className="w-10 shrink-0 text-xs text-muted-foreground">{p.unidad}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border bg-card p-3 shadow-lg">
        <span className="text-sm text-muted-foreground">{cambios.length === 0 ? "Sin cambios" : `${cambios.length} cambio(s) sin guardar`}</span>
        <Button onClick={guardar} disabled={guardando || cambios.length === 0 || invalidos.length > 0}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
