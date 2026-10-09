"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TIPO_INTERVENCION } from "@/lib/etiquetas";

interface Props {
  /** Desde la ficha se conoce el estudiante; desde la lista se escribe el código */
  estudianteId?: string;
  /** Alertas abiertas del estudiante para vincular la intervención (opcional) */
  alertas?: { id: string; motivo: string }[];
  variante?: "default" | "outline";
}

/** Botón + diálogo para registrar una intervención de Bienestar */
export function RegistrarIntervencion({ estudianteId, alertas = [], variante = "default" }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState("TUTORIA");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [alertaId, setAlertaId] = useState(alertas[0]?.id ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setAbierto(false);
    setError(null);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        ...(estudianteId ? { estudianteId } : { codigo: codigo.trim() }),
        tipo,
        descripcion,
        ...(tipo === "APOYO_ECONOMICO" && monto ? { montoApoyo: Number(monto) } : {}),
        ...(alertaId ? { alertaId } : {}),
      };
      const res = await fetch("/api/intervenciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([j.error, ...(j.detalles ?? []).map((d: { mensaje: string }) => d.mensaje)].filter(Boolean).join(" — "));
      setDescripcion("");
      setMonto("");
      setCodigo("");
      cerrar();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la intervención.");
    } finally {
      setGuardando(false);
    }
  }

  const valido = descripcion.trim().length >= 10 && (estudianteId || codigo.trim().length >= 3) && (tipo !== "APOYO_ECONOMICO" || Number(monto) > 0);

  return (
    <>
      <Button variant={variante} size="sm" onClick={() => setAbierto(true)}>
        <HeartHandshake className="h-4 w-4" aria-hidden /> Registrar intervención
      </Button>
      <Dialog abierto={abierto} onCerrar={cerrar} titulo="Registrar intervención" descripcion="Queda en el periodo actual y en curso hasta que registres su resultado.">
        <div className="space-y-3">
          {!estudianteId && (
            <div className="space-y-1.5">
              <Label htmlFor="int-codigo">Código del estudiante</Label>
              <Input id="int-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. UCC202410012" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="int-tipo">Tipo de intervención</Label>
            <Select id="int-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPO_INTERVENCION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          {tipo === "APOYO_ECONOMICO" && (
            <div className="space-y-1.5">
              <Label htmlFor="int-monto">Monto del apoyo (COP)</Label>
              <Input id="int-monto" type="number" min={1} step={1000} inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej. 800000" />
            </div>
          )}
          {alertas.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="int-alerta">Responde a la alerta</Label>
              <Select id="int-alerta" value={alertaId} onChange={(e) => setAlertaId(e.target.value)}>
                <option value="">Ninguna</option>
                {alertas.map((a) => <option key={a.id} value={a.id}>{a.motivo.length > 70 ? `${a.motivo.slice(0, 70)}…` : a.motivo}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">La alerta pasará a «en seguimiento».</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="int-desc">Descripción</Label>
            <Textarea id="int-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={1000} placeholder="Ej. Tutoría semanal de Cálculo I con monitor del programa." />
            <p className="text-right text-xs text-muted-foreground">{descripcion.length}/1000</p>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button onClick={guardar} disabled={!valido || guardando}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
