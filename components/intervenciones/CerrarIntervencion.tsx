"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Cierra (completada) o cancela una intervención en curso, registrando su resultado */
export function CerrarIntervencion({ id, estudiante }: { id: string; estudiante: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState("COMPLETADA");
  const [resultado, setResultado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/intervenciones/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado, resultado }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([j.error, ...(j.detalles ?? []).map((d: { mensaje: string }) => d.mensaje)].filter(Boolean).join(" — "));
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>Cerrar</Button>
      <Dialog abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Cerrar intervención" descripcion={`Estudiante: ${estudiante}`}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`cierre-estado-${id}`}>Resultado</Label>
            <Select id={`cierre-estado-${id}`} value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="COMPLETADA">Completada</option>
              <option value="CANCELADA">Cancelada</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`cierre-res-${id}`}>¿Qué pasó?</Label>
            <Textarea id={`cierre-res-${id}`} value={resultado} onChange={(e) => setResultado(e.target.value)} maxLength={1000} placeholder="Ej. Asistió a 8 de 10 sesiones y aprobó el parcial." />
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={resultado.trim().length < 10 || guardando}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
