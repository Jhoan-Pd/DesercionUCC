import { HeartHandshake } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NivelBadge } from "@/components/riesgo/NivelBadge";
import type { Recurso, Dimension } from "@/services/encuesta/preguntas";
import { BarrasDimension } from "./BarrasDimension";

interface Props {
  resultado: { puntaje: number; nivel: "BAJO" | "MEDIO" | "ALTO"; puntajesDimension: Partial<Record<Dimension, number>>; recursos: Recurso[]; intencionRetiro?: boolean };
  autorizaContacto: boolean;
  alertaGenerada?: boolean;
  fecha?: string;
}

const MENSAJE = {
  BAJO: "Tus respuestas no muestran señales importantes de riesgo. Si algo cambia, puedes volver a responder cuando quieras.",
  MEDIO: "Hay aspectos que vale la pena atender a tiempo. Revisa los recursos sugeridos: pedir apoyo temprano marca la diferencia.",
  ALTO: "Tus respuestas indican un riesgo alto de abandonar tus estudios. No estás solo(a): la universidad tiene apoyos pensados para tu situación.",
};

export function ResultadoEncuestaVista({ resultado, autorizaContacto, alertaGenerada, fecha }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tu resultado{fecha ? ` del ${new Date(fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}` : ""}</CardTitle>
          <CardDescription>Puntaje de 0 (sin señales de riesgo) a 100 (muchas señales).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-lg border p-4 text-center">
            <span className="text-5xl font-bold tabular-nums">{resultado.puntaje}</span>
            <NivelBadge nivel={resultado.nivel} className="mt-2" />
          </div>
          <div className="space-y-3">
            <p className="text-sm">{MENSAJE[resultado.nivel]}</p>
            <BarrasDimension puntajes={resultado.puntajesDimension} />
          </div>
        </CardContent>
      </Card>

      {resultado.nivel === "ALTO" && (
        <Alert variant={alertaGenerada ? "success" : "warning"}>
          {alertaGenerada
            ? "Como lo autorizaste, Bienestar Universitario fue notificado y se pondrá en contacto contigo."
            : autorizaContacto
              ? "Bienestar Universitario fue notificado."
              : "No autorizaste ser contactado, así que no avisamos a Bienestar. Si quieres apoyo, acércate directamente: tu decisión se respeta."}
        </Alert>
      )}
      {resultado.intencionRetiro && (
        <Alert variant="info">
          Antes de decidir retirarte, usa la Calculadora de impacto para comparar alternativas como aplazar, cambiar de jornada o pedir apoyo financiero.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-primary" aria-hidden /> Recursos para ti</CardTitle>
          <CardDescription>Según las dimensiones donde tus respuestas muestran más dificultad.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {resultado.recursos.map((r) => (
            <div key={r.titulo} className="rounded-md border p-3 text-sm">
              <p className="font-semibold">{r.titulo}</p>
              <p className="text-muted-foreground">{r.descripcion}</p>
              <p className="mt-1 text-xs"><b>Dónde:</b> {r.comoAcceder}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Este resultado es orientativo, no un diagnóstico. Si atraviesas una situación difícil o de crisis, busca apoyo en Bienestar Universitario o en los servicios de salud de tu EPS.
      </p>
    </div>
  );
}
