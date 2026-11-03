"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EtapaValidacion, PedidoValidacion, RespuestaValidacion, VistaPrevia } from "@/workers/protocolo-validacion";

export type EstadoValidacion =
  | { tipo: "inactivo" }
  | { tipo: "revisando"; etapa: EtapaValidacion }
  | { tipo: "lista"; vista: VistaPrevia }
  | { tipo: "error"; mensaje: string }
  /** Navegador sin Web Workers: se sube sin vista previa y el servidor valida */
  | { tipo: "no-disponible" };

/**
 * Revisa el archivo elegido en un Web Worker. Ciclo de vida del worker:
 *  - se crea la primera vez que hace falta (no se descarga si nunca se elige un archivo);
 *  - si llega otro archivo mientras revisa el anterior, se TERMINA y se crea uno nuevo (un Excel
 *    grande bloquea el hilo del worker y el pedido nuevo tendría que esperar);
 *  - se termina al salir de la página.
 */
export function useValidacionArchivo() {
  const worker = useRef<Worker | null>(null);
  const ultimoId = useRef(0);
  const ocupado = useRef(false);
  const [estado, setEstado] = useState<EstadoValidacion>({ tipo: "inactivo" });

  const crearWorker = useCallback(() => {
    const w = new Worker(new URL("../../workers/validar-archivo.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = ({ data }: MessageEvent<RespuestaValidacion>) => {
      if (data.id !== ultimoId.current) return; // respuesta de un archivo anterior
      if (data.tipo === "progreso") return setEstado({ tipo: "revisando", etapa: data.etapa });
      ocupado.current = false;
      setEstado(data.tipo === "lista" ? { tipo: "lista", vista: data.vista } : { tipo: "error", mensaje: data.mensaje });
    };
    w.onerror = () => {
      ocupado.current = false;
      setEstado({ tipo: "no-disponible" });
    };
    return w;
  }, []);

  useEffect(() => () => worker.current?.terminate(), []);

  const validar = useCallback(
    async (archivo: File | null) => {
      const id = ++ultimoId.current;
      if (!archivo) return setEstado({ tipo: "inactivo" });
      if (typeof Worker === "undefined") return setEstado({ tipo: "no-disponible" });
      if (ocupado.current) {
        worker.current?.terminate();
        worker.current = null;
      }
      worker.current ??= crearWorker();
      ocupado.current = true;
      setEstado({ tipo: "revisando", etapa: "leyendo" });
      // arrayBuffer() da una copia propia de los bytes: se TRANSFIERE al worker (sin copiarla otra vez)
      // y el File original sigue disponible para subirlo después
      const buffer = await archivo.arrayBuffer();
      if (id !== ultimoId.current) return;
      const pedido: PedidoValidacion = { id, nombre: archivo.name, buffer };
      worker.current.postMessage(pedido, [buffer]);
    },
    [crearWorker],
  );

  return { estado, validar };
}
