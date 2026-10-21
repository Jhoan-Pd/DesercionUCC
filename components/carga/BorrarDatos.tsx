"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { enviarJson } from "@/lib/cliente-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/** Borra todos los estudiantes cargados. Pide escribir BORRAR para confirmar (sin diálogos del navegador). */
export function BorrarDatos({ total }: { total: number }) {
  const router = useRouter();
  const [confirmacion, setConfirmacion] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function borrar() {
    setCargando(true);
    try {
      const r = await enviarJson<{ estudiantes: number }>("/api/estudiantes", "DELETE");
      setMensaje({ tipo: "success", texto: `Se borraron ${r.estudiantes.toLocaleString("es-CO")} estudiantes y sus evaluaciones.` });
      setAbierto(false);
      setConfirmacion("");
      router.refresh();
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo borrar." });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-3">
      {mensaje && <Alert variant={mensaje.tipo}>{mensaje.texto}</Alert>}
      {!abierto ? (
        <Button variant="outline" onClick={() => setAbierto(true)} disabled={total === 0}>
          <Trash2 className="h-4 w-4" aria-hidden /> Borrar todos los estudiantes
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-riesgo-alto-borde bg-riesgo-alto-fondo p-4">
          <p className="text-sm text-riesgo-alto">
            Se borrarán los {total.toLocaleString("es-CO")} estudiantes, sus evaluaciones, el historial de cargas y los modelos entrenados. Las cuentas de usuario no se tocan.
            Escribe <strong>BORRAR</strong> para confirmar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="max-w-[160px]" aria-label="Escribe BORRAR para confirmar" />
            <Button variant="destructive" disabled={confirmacion !== "BORRAR" || cargando} onClick={borrar}>
              {cargando ? "Borrando…" : "Confirmar"}
            </Button>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
