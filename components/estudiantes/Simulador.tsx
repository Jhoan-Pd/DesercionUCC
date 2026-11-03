"use client";

import { useEffect, useRef, useState } from "react";
import { Code, ConnectError } from "@connectrpc/connect";
import { FlaskConical } from "lucide-react";
import { motorRiesgo } from "@/lib/grpc/cliente";
import { datosAProto, nivelDesdeProto } from "@/lib/grpc/mapeo";
import type { EvaluarResponse } from "@/lib/grpc/gen/observatorio/riesgo/v1/motor_riesgo_pb";
import { VARIABLES, type ClaveVariable, type DatosEstudiante } from "@/services/riesgo/variables";
import type { NivelRiesgo } from "@/services/riesgo/niveles";
import { NivelBadge } from "./NivelBadge";
import { BarraPuntaje } from "./BarraPuntaje";

/** Espera desde la última tecla antes de consultar el motor */
const ESPERA_MS = 350;

/** Paso y límites de cada campo numérico (los mismos rangos los vuelve a validar el servidor) */
const CAMPO_NUMERICO: Partial<Record<ClaveVariable, { min: number; max: number; paso: number }>> = {
  semestre: { min: 1, max: 14, paso: 1 },
  promedio: { min: 0, max: 5, paso: 0.1 },
  materiasPerdidas: { min: 0, max: 20, paso: 1 },
  asistencia: { min: 0, max: 100, paso: 1 },
  estrato: { min: 1, max: 6, paso: 1 },
  puntajeSaber11: { min: 0, max: 500, paso: 1 },
  edad: { min: 14, max: 90, paso: 1 },
};

type Valor = number | boolean | null;

/**
 * Simulador «¿y si…?»: Bienestar cambia un dato (por ejemplo, resolver la mora o subir el promedio)
 * y ve cómo cambiaría el riesgo. Cada cambio llama al método Evaluar del servicio gRPC MotorRiesgo,
 * que calcula con el mismo método vigente que la ficha y NO guarda nada.
 */
export function Simulador({ datos, actual }: { datos: DatosEstudiante; actual: { puntaje: number; nivel: NivelRiesgo } }) {
  const [valores, setValores] = useState<DatosEstudiante>(datos);
  const [resultado, setResultado] = useState<EvaluarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [milisegundos, setMilisegundos] = useState<number | null>(null);
  const enCurso = useRef<AbortController | null>(null);

  useEffect(() => {
    const temporizador = setTimeout(async () => {
      enCurso.current?.abort(); // una respuesta vieja no debe pisar a la nueva
      const control = new AbortController();
      enCurso.current = control;
      const inicio = performance.now();
      try {
        const r = await motorRiesgo.evaluar({ datos: datosAProto(valores) }, { signal: control.signal });
        setResultado(r);
        setError(null);
        setMilisegundos(Math.round(performance.now() - inicio));
      } catch (e) {
        if (control.signal.aborted) return;
        const err = ConnectError.from(e);
        setError(err.code === Code.InvalidArgument ? `Revisa los valores: ${err.rawMessage}` : "No fue posible consultar el motor de riesgo.");
      }
    }, ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [valores]);

  useEffect(() => () => enCurso.current?.abort(), []);

  const cambiar = (clave: ClaveVariable, valor: Valor) => setValores((v) => ({ ...v, [clave]: valor }));
  const nivel = resultado ? nivelDesdeProto(resultado.nivel) : null;
  const diferencia = resultado ? resultado.puntaje - actual.puntaje : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {VARIABLES.map((v) => (
          // Campo pegado abajo: si una etiqueta ocupa dos líneas, los campos de la fila siguen alineados
          <label key={v.clave} className="flex flex-col justify-end gap-1">
            <span className="block text-[11px] font-semibold uppercase tracking-ceja text-grafito">{v.etiqueta}</span>
            {v.tipo === "booleano" ? (
              <select
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                value={valores[v.clave] === null || valores[v.clave] === undefined ? "" : String(valores[v.clave])}
                onChange={(e) => cambiar(v.clave, e.target.value === "" ? null : e.target.value === "true")}
              >
                <option value="">Sin dato</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm tabular-nums"
                min={CAMPO_NUMERICO[v.clave]?.min}
                max={CAMPO_NUMERICO[v.clave]?.max}
                step={CAMPO_NUMERICO[v.clave]?.paso}
                placeholder="Sin dato"
                value={valores[v.clave] === null || valores[v.clave] === undefined ? "" : String(valores[v.clave])}
                onChange={(e) => cambiar(v.clave, e.target.value === "" ? (v.clave === "semestre" ? 0 : null) : Number(e.target.value))}
              />
            )}
          </label>
        ))}
      </div>

      <div className="rounded-lg border bg-papel p-4" aria-live="polite">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : resultado && nivel ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <NivelBadge nivel={nivel} />
              <BarraPuntaje puntaje={resultado.puntaje} nivel={nivel} />
              <span className="text-sm text-grafito">
                {diferencia === 0 ? "igual que ahora" : `${diferencia > 0 ? "+" : "−"}${Math.abs(diferencia)} puntos frente al actual (${actual.puntaje})`}
              </span>
            </div>
            {resultado.factores.length > 0 && (
              <p className="text-sm text-grafito">
                Lo que más pesa: {resultado.factores.slice(0, 3).map((f) => f.etiqueta.toLowerCase()).join(", ")}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Calculando…</p>
        )}
      </div>

      <p className="meta flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        {"// gRPC-Web · MotorRiesgoService/Evaluar · Protobuf binario"}
        {milisegundos !== null ? ` · ${milisegundos} ms` : ""} · no se guarda nada
      </p>
    </div>
  );
}
