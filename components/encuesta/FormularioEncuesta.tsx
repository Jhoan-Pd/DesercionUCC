"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DIMENSIONES, ESCALA, PREGUNTAS, type Dimension } from "@/services/encuesta/preguntas";
import type { EncuestaGuardada } from "@/services/encuesta/ServicioEncuesta";
import { ResultadoEncuestaVista } from "./ResultadoEncuestaVista";

type Paso = "consentimiento" | "preguntas" | "resultado";

export function FormularioEncuesta() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("consentimiento");
  const [consentimiento, setConsentimiento] = useState(false);
  const [autorizaContacto, setAutorizaContacto] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<EncuestaGuardada | null>(null);

  const respondidas = Object.keys(respuestas).length;
  const porDimension = useMemo(() => {
    const dims = Object.keys(DIMENSIONES) as Dimension[];
    return dims.map((d) => ({ d, preguntas: PREGUNTAS.filter((p) => p.dimension === d) }));
  }, []);

  async function enviar() {
    setError(null);
    if (respondidas < PREGUNTAS.length) {
      setError(`Te faltan ${PREGUNTAS.length - respondidas} preguntas por responder.`);
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/encuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentimiento, autorizaContacto, respuestas }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error([j.error, ...(j.detalles ?? []).map((x: { mensaje: string }) => x.mensaje)].filter(Boolean).join(" — "));
      setResultado(j as EncuestaGuardada);
      setPaso("resultado");
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible enviar la encuesta.");
    } finally {
      setEnviando(false);
    }
  }

  if (paso === "resultado" && resultado) {
    return (
      <div className="space-y-4">
        <ResultadoEncuestaVista resultado={resultado.resultado} autorizaContacto={resultado.autorizaContacto} alertaGenerada={resultado.alertaGenerada} />
        <Button variant="outline" onClick={() => { setRespuestas({}); setPaso("consentimiento"); setConsentimiento(false); setResultado(null); }}>
          Responder de nuevo
        </Button>
      </div>
    );
  }

  if (paso === "consentimiento") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Consentimiento informado</CardTitle>
          <CardDescription>Antes de empezar, lee cómo usaremos tus respuestas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>La encuesta tiene {PREGUNTAS.length} preguntas y toma unos 3 minutos.</li>
            <li>Tus respuestas se usan para estimar tu nivel de riesgo de abandonar los estudios y sugerirte recursos de apoyo.</li>
            <li>Solo tú y el personal autorizado de Bienestar Universitario pueden ver tus resultados individuales. Los reportes institucionales son anónimos.</li>
            <li>Puedes conocer, actualizar y solicitar la eliminación de tus datos conforme a la Ley 1581 de 2012 (habeas data).</li>
          </ul>
          <label className="flex items-start gap-3 rounded-md border p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
            <span><b>Acepto</b> el tratamiento de mis datos personales para esta finalidad. (Obligatorio)</span>
          </label>
          <label className="flex items-start gap-3 rounded-md border p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={autorizaContacto} onChange={(e) => setAutorizaContacto(e.target.checked)} />
            <span>Autorizo que Bienestar Universitario me contacte si el resultado indica un riesgo alto. (Opcional)</span>
          </label>
          <div className="flex justify-end">
            <Button onClick={() => setPaso("preguntas")} disabled={!consentimiento}>
              Comenzar <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-10 rounded-lg border bg-card/95 p-3 backdrop-blur lg:top-2">
        <div className="flex items-center justify-between text-sm">
          <span>{respondidas} de {PREGUNTAS.length} respondidas</span>
          <span className="text-muted-foreground">1 = Totalmente en desacuerdo · 5 = Totalmente de acuerdo</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={PREGUNTAS.length} aria-valuenow={respondidas} aria-label="Progreso de la encuesta">
          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${(respondidas / PREGUNTAS.length) * 100}%` }} />
        </div>
      </div>

      {porDimension.map(({ d, preguntas }) => (
        <Card key={d}>
          <CardHeader>
            <CardTitle>{DIMENSIONES[d].titulo}</CardTitle>
            <CardDescription>{DIMENSIONES[d].descripcion}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {preguntas.map((p) => (
              <fieldset key={p.clave} className="space-y-2">
                <legend className="text-sm font-medium">{p.texto}</legend>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {ESCALA.map((op) => {
                    const marcado = respuestas[p.clave] === op.valor;
                    return (
                      <label
                        key={op.valor}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border px-1 py-2 text-center text-xs transition-colors ${marcado ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-secondary"}`}
                      >
                        <input
                          type="radio"
                          name={p.clave}
                          value={op.valor}
                          checked={marcado}
                          onChange={() => setRespuestas((r) => ({ ...r, [p.clave]: op.valor }))}
                          className="sr-only"
                        />
                        <span className="text-base">{op.valor}</span>
                        <span className="hidden leading-tight sm:block">{op.etiqueta}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </CardContent>
        </Card>
      ))}

      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={() => setPaso("consentimiento")}>Atrás</Button>
        <Button onClick={enviar} disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Ver mi resultado
        </Button>
      </div>
    </div>
  );
}
