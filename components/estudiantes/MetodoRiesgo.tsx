import { Info } from "lucide-react";
import type { EstadoModelo } from "@/services/riesgo/ServicioEvaluacion";
import { UMBRAL_ALTO, UMBRAL_MEDIO } from "@/services/riesgo/factores";

/** Explica con qué método se está calculando el riesgo y por qué */
export function MetodoRiesgo({ modelo }: { modelo: EstadoModelo }) {
  const auc = modelo.metricas?.auc;
  return (
    <div className="flex gap-3 rounded-lg border border-bruma bg-[#EEF3F6] p-5 text-sm leading-relaxed text-marino">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {modelo.metodo === "MODELO" ? (
          <>
            <p className="font-semibold">Riesgo calculado con el modelo entrenado con estudiantes de la UCC ({modelo.version})</p>
            <p>
              Regresión logística ajustada con {modelo.metricas?.estudiantes.toLocaleString("es-CO")} estudiantes que ya se retiraron o se graduaron. El puntaje es la probabilidad
              estimada de retirarse.
              {Number.isFinite(auc) && ` Con estudiantes que no usó para aprender acierta el orden de riesgo el ${Math.round((auc as number) * 100)} % de las veces (AUC).`}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">Riesgo calculado con el puntaje por factores</p>
            <p>
              Suma puntos por los factores de deserción que identifica el Ministerio de Educación (SPADIES) y los indicadores académicos del periodo: promedio, materias
              perdidas, asistencia, pagos pendientes, primeros semestres, Saber 11, trabajo y situación económica. Es una alerta de 0 a 100 (medio desde {UMBRAL_MEDIO}, alto
              desde {UMBRAL_ALTO}), no una probabilidad.
            </p>
            <p className="meta text-marino/80">{"// "}{modelo.motivo}</p>
          </>
        )}
      </div>
    </div>
  );
}
