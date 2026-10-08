"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/** Vuelve a aplicar el modelo activo a todos los estudiantes activos y aplazados */
export function BotonRecalcular() {
  const router = useRouter();
  const [estado, setEstado] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function recalcular() {
    setCargando(true);
    setEstado(null);
    try {
      const res = await fetch("/api/riesgo/recalcular", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "No se pudo recalcular.");
      setEstado({ tipo: "success", texto: `Se recalcularon ${j.estudiantes} estudiantes con el modelo ${j.version}: ${j.alto} en riesgo alto y ${j.medio} medio. Alertas nuevas: ${j.alertasNuevas}.` });
      router.refresh();
    } catch (e) {
      setEstado({ tipo: "error", texto: e instanceof Error ? e.message : "Error inesperado." });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={recalcular} disabled={cargando}>
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
        {cargando ? "Recalculando..." : "Recalcular puntajes"}
      </Button>
      {estado && <Alert variant={estado.tipo}>{estado.texto}</Alert>}
    </div>
  );
}
