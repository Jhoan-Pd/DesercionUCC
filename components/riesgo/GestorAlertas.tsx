"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AlertaFila {
  id: string;
  origen: string;
  motivo: string;
  estado: "ABIERTA" | "EN_SEGUIMIENTO" | "CERRADA";
  creadaEn: string;
  creadaPor: string | null;
  curso: string | null;
}

const ORIGEN: Record<string, string> = { MODELO: "Modelo de riesgo", DOCENTE: "Docente", ENCUESTA: "Encuesta", BIENESTAR: "Bienestar" };

/** Alertas del estudiante: Bienestar cambia su estado o registra una nueva */
export function GestorAlertas({ estudianteId, alertas }: { estudianteId: string; alertas: AlertaFila[] }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function cambiar(id: string, estado: string) {
    setGuardando(id);
    setError(null);
    try {
      const res = await fetch(`/api/alertas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "No se pudo actualizar la alerta.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setGuardando(null);
    }
  }

  async function crear() {
    setGuardando("nueva");
    setError(null);
    try {
      const res = await fetch("/api/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estudianteId, motivo }) });
      const j = await res.json();
      if (!res.ok) throw new Error([j.error, ...(j.detalles ?? []).map((d: { mensaje: string }) => d.mensaje)].filter(Boolean).join(" — "));
      setAbierto(false);
      setMotivo("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>Alertas</CardTitle>
          <CardDescription>Generadas por el modelo, reportadas por docentes, por la encuesta o por Bienestar.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Nueva alerta
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="error">{error}</Alert>}
        {alertas.length === 0 && <p className="text-sm text-muted-foreground">Este estudiante no tiene alertas.</p>}
        <ul className="space-y-3">
          {alertas.map((a) => (
            <li key={a.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ORIGEN[a.origen] ?? a.origen}
                  {a.creadaPor ? ` · ${a.creadaPor}` : ""} · {new Date(a.creadaEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
                </p>
                <div className="flex items-center gap-2">
                  {guardando === a.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
                  <label htmlFor={`estado-${a.id}`} className="sr-only">Estado de la alerta</label>
                  <Select id={`estado-${a.id}`} value={a.estado} onChange={(e) => cambiar(a.id, e.target.value)} disabled={guardando !== null} className="h-8 w-40 text-xs">
                    <option value="ABIERTA">Abierta</option>
                    <option value="EN_SEGUIMIENTO">En seguimiento</option>
                    <option value="CERRADA">Cerrada</option>
                  </Select>
                </div>
              </div>
              <p className="mt-1 text-sm">{a.motivo}</p>
              {a.curso && <p className="mt-1 text-xs text-muted-foreground">Curso: {a.curso}</p>}
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Registrar alerta de Bienestar" descripcion="Describe la situación observada. La alerta quedará abierta para seguimiento.">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-alerta">Motivo</Label>
            <Textarea id="motivo-alerta" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ej. Manifestó dificultades para pagar el próximo semestre." />
            <p className="text-right text-xs text-muted-foreground">{motivo.length}/500</p>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={crear} disabled={motivo.trim().length < 10 || guardando === "nueva"}>
              {guardando === "nueva" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar alerta
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
