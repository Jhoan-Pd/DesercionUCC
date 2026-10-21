"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, User } from "lucide-react";
import { enviarJson } from "@/lib/cliente-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { NivelBadge } from "@/components/estudiantes/NivelBadge";
import { TextoAgente } from "./TextoAgente";

interface EstudianteMencionado {
  codigo: string;
  nombre: string;
  programa: string;
  nivel: "ALTO" | "MEDIO" | "BAJO" | null;
  puntaje: number | null;
}

interface Mensaje {
  rol: "usuario" | "agente";
  texto: string;
  estudiantes?: EstudianteMencionado[];
}

const SUGERENCIAS = [
  "¿Cuántos estudiantes están en riesgo alto y en qué programas?",
  "¿Qué factores de riesgo son los más comunes?",
  "Muéstrame los estudiantes de primer y segundo semestre con riesgo alto",
  "¿Cómo ha cambiado la matrícula de la UCC Pasto desde 2015?",
];

/** Chat con el agente de IA. Los nombres de los estudiantes se agregan en el servidor (no se envían a Gemini). */
export function ChatAgente() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, cargando]);

  async function enviar(texto: string) {
    const limpia = texto.trim();
    if (!limpia || cargando) return;
    const historial = mensajes.map(({ rol, texto }) => ({ rol, texto }));
    setMensajes((m) => [...m, { rol: "usuario", texto: limpia }]);
    setPregunta("");
    setError(null);
    setCargando(true);
    try {
      const r = await enviarJson<{ respuesta: string; estudiantes: EstudianteMencionado[] }>("/api/agente", "POST", { pregunta: limpia, historial });
      setMensajes((m) => [...m, { rol: "agente", texto: r.respuesta, estudiantes: r.estudiantes }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "El agente no pudo responder.");
      setMensajes((m) => m.slice(0, -1));
      setPregunta(limpia);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col rounded-xl border bg-card">
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-8" aria-live="polite">
        {mensajes.length === 0 && (
          <div className="space-y-4">
            <p className="meta">{"// algunas ideas para empezar"}</p>
            <p className="max-w-2xl text-[15px] text-grafito">Pregúntale por los estudiantes en riesgo, los factores más frecuentes o las cifras oficiales de la UCC.</p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)} className="rounded-sm border border-tinta/15 bg-papel px-3 py-2 text-left text-sm text-grafito transition-colors hover:border-tinta/40 hover:text-tinta">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={m.rol === "usuario" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.rol === "usuario" ? "max-w-[85%] rounded-lg bg-tinta px-4 py-3 text-sm text-white" : "w-full max-w-[90%] space-y-3 rounded-lg border-l-2 border-petroleo bg-papel px-5 py-4"}>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-ceja opacity-75">
                {m.rol === "usuario" ? <User className="h-3.5 w-3.5" aria-hidden /> : <Bot className="h-3.5 w-3.5" aria-hidden />}
                {m.rol === "usuario" ? "Tú" : "Agente"}
              </p>
              {m.rol === "usuario" ? <p className="whitespace-pre-wrap">{m.texto}</p> : <TextoAgente texto={m.texto} />}
              {m.estudiantes && m.estudiantes.length > 0 && (
                <div className="space-y-1 border-t pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-ceja text-grafito">Estudiantes mencionados</p>
                  <ul className="flex flex-wrap gap-2">
                    {m.estudiantes.map((e) => (
                      <li key={e.codigo}>
                        <Link href={`/estudiantes/${encodeURIComponent(e.codigo)}`} className="inline-flex items-center gap-2 rounded-sm border bg-card px-2 py-1 text-xs hover:border-tinta/40">
                          <span className="font-medium">{e.nombre}</span>
                          <span className="font-mono text-[11px] text-piedra">{e.codigo}</span>
                          {e.nivel && <NivelBadge nivel={e.nivel} />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {cargando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Bot className="h-4 w-4 animate-pulse" aria-hidden /> El agente está consultando los datos…
          </p>
        )}
        <div ref={finRef} />
      </div>
      <form
        className="space-y-2 border-t p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pregunta);
        }}
      >
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Tu pregunta</span>
            <Textarea
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(pregunta);
                }
              }}
              rows={2}
              maxLength={1000}
              placeholder="Escribe tu pregunta… (Enter para enviar)"
              className="min-h-[44px] resize-none"
            />
          </label>
          <Button type="submit" disabled={cargando || pregunta.trim().length < 2} aria-label="Enviar pregunta" className="h-auto">
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <p className="meta">{"// "}El agente solo recibe datos académicos sin nombres. Sus respuestas son una ayuda: verifica en la ficha antes de actuar.</p>
      </form>
    </div>
  );
}
