"use client";

import { useState } from "react";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import { enviarJson } from "@/lib/cliente-api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { TextoAgente } from "@/components/agente/TextoAgente";

interface Resultado {
  explicacion: string;
  origen: "IA" | "BASICA";
  modeloIa: string | null;
  explicadaEn: string | null;
  aviso: string | null;
}

/** Explicación del riesgo redactada por el agente de IA (se genera a pedido y queda guardada) */
export function ExplicacionAgente({ codigo, inicial }: { codigo: string; inicial: { explicacion: string; modeloIa: string | null; explicadaEn: string | null } | null }) {
  const [resultado, setResultado] = useState<Resultado | null>(inicial ? { ...inicial, origen: "IA", aviso: null } : null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedir(regenerar: boolean) {
    setCargando(true);
    setError(null);
    try {
      setResultado(await enviarJson<Resultado>(`/api/estudiantes/${encodeURIComponent(codigo)}/explicacion`, "POST", { regenerar }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la explicación.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-3">
      {!resultado && !cargando && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            El agente redacta por qué el estudiante tiene este nivel de riesgo y qué acciones de Bienestar podrían ayudarle. Solo recibe los datos académicos, sin nombre ni código.
          </p>
          <Button onClick={() => pedir(false)}>
            <Sparkles className="h-4 w-4" aria-hidden /> Generar explicación
          </Button>
        </div>
      )}
      {cargando && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Bot className="h-4 w-4 animate-pulse" aria-hidden /> El agente está analizando el caso…
        </p>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {resultado && !cargando && (
        <div className="space-y-3">
          {resultado.aviso && <Alert variant="warning">{resultado.aviso}</Alert>}
          <div className="rounded-md bg-secondary/50 p-4">
            <TextoAgente texto={resultado.explicacion} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {resultado.origen === "IA"
                ? `Redactado por ${resultado.modeloIa ?? "Gemini"}${resultado.explicadaEn ? ` el ${new Date(resultado.explicadaEn).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })}` : ""}. Revísalo antes de actuar.`
                : "Explicación calculada por el sistema (sin IA)."}
            </span>
            <Button variant="outline" size="sm" onClick={() => pedir(true)}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Volver a generar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
