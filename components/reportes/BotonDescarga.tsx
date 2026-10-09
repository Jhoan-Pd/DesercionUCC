"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  url: string;
  formato: "pdf" | "xlsx";
  onError: (mensaje: string | null) => void;
  onDescargado?: () => void;
}

/** Nombre sugerido por el servidor en Content-Disposition */
function nombreDesdeCabecera(cabecera: string | null, respaldo: string): string {
  const coincidencia = cabecera?.match(/filename="?([^";]+)"?/i);
  return coincidencia?.[1] ?? respaldo;
}

/**
 * Descarga un reporte con fetch (en lugar de un enlace directo) para mostrar el estado de carga
 * y los errores de la API —por ejemplo, si no hay un periodo activo— en lugar de una página en blanco.
 */
export function BotonDescarga({ url, formato, onError, onDescargado }: Props) {
  const [cargando, setCargando] = useState(false);

  async function descargar() {
    setCargando(true);
    onError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        throw new Error(cuerpo.error ?? "No se pudo generar el reporte.");
      }
      const blob = await res.blob();
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombreDesdeCabecera(res.headers.get("Content-Disposition"), `reporte.${formato}`);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
      onDescargado?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo generar el reporte.");
    } finally {
      setCargando(false);
    }
  }

  const Icono = cargando ? Loader2 : formato === "pdf" ? FileText : FileSpreadsheet;
  return (
    <Button type="button" variant={formato === "pdf" ? "default" : "outline"} size="sm" onClick={descargar} disabled={cargando} aria-busy={cargando}>
      <Icono className={cargando ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
      {cargando ? "Generando..." : formato === "pdf" ? "PDF" : "Excel"}
      {!cargando && <Download className="h-3.5 w-3.5 opacity-70" aria-hidden />}
    </Button>
  );
}
