"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import { enviarFormulario } from "@/lib/cliente-api";
import { formatoEntero, formatoNumero } from "@/lib/formato";
import type { ResumenCarga } from "@/services/carga/ServicioCarga";
import { TAMANO_MAXIMO, TAMANO_MAXIMO_MB } from "@/services/carga/limites";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";


/** Subida del archivo de estudiantes (.xlsx o .csv) y resumen del resultado */
export function CargaArchivo() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenCarga | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  async function subir() {
    if (!archivo) return;
    if (archivo.size > TAMANO_MAXIMO) {
      setError(`El archivo pesa más de ${TAMANO_MAXIMO_MB} MB. Divídelo en varios archivos o quita las columnas que no se usan.`);
      return;
    }
    setCargando(true);
    setError(null);
    setResumen(null);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      setResumen(await enviarFormulario<ResumenCarga>("/api/cargas", datos));
      setArchivo(null);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el archivo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setArchivo(f);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-tinta/25 bg-papel px-6 py-12 text-center transition-colors ${arrastrando ? "border-petroleo bg-hoja" : "hover:border-tinta/50"}`}
      >
        <FileSpreadsheet className="h-9 w-9 text-petroleo" aria-hidden />
        <span className="font-medium">{archivo ? archivo.name : "Arrastra aquí el archivo o haz clic para elegirlo"}</span>
        <span className="meta">{archivo ? `${formatoEntero(archivo.size / 1024)} KB` : `Excel (.xlsx) o CSV · máximo ${TAMANO_MAXIMO_MB} MB`}</span>
        <input ref={entrada} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
      </label>

      <Button onClick={subir} disabled={!archivo || cargando}>
        <Upload className="h-4 w-4" aria-hidden /> {cargando ? "Cargando y calculando el riesgo…" : "Cargar estudiantes"}
      </Button>

      {error && <Alert variant="error">{error}</Alert>}

      {resumen && (
        <div className="space-y-3">
          {resumen.nuevos + resumen.actualizados > 0 ? (
            <Alert variant="success" titulo={`Archivo «${resumen.archivo}» cargado`}>
              {formatoNumero(resumen.nuevos)} estudiantes nuevos y {formatoNumero(resumen.actualizados)} actualizados. Se calculó el riesgo de {formatoNumero(resumen.evaluados)} estudiantes activos.
            </Alert>
          ) : (
            <Alert variant="error" titulo="No se cargó ningún estudiante">
              Revisa los errores de abajo y vuelve a intentarlo.
            </Alert>
          )}
          {resumen.nuevos + resumen.actualizados > 0 && (
            <Alert variant={resumen.modelo.estado === "ACTIVADO" ? "success" : "info"} titulo={resumen.modelo.estado === "ACTIVADO" ? "Modelo entrenado y activado" : "Método de cálculo"}>
              {resumen.modelo.estado === "INSUFICIENTE" ? `${resumen.modelo.motivo} Mientras tanto se usa el puntaje por factores.` : resumen.modelo.motivo}
            </Alert>
          )}
          {resumen.ignoradas.length > 0 && <Alert variant="warning">Columnas que no se reconocieron y se ignoraron: {resumen.ignoradas.join(", ")}.</Alert>}
          {resumen.totalErrores > 0 && (
            <div className="rounded-lg border border-riesgo-alto-borde">
              <p className="border-b border-riesgo-alto-borde bg-riesgo-alto-fondo px-4 py-2 text-sm font-semibold text-riesgo-alto">
                {formatoNumero(resumen.totalErrores)} filas no se cargaron{resumen.totalErrores > resumen.errores.length ? ` (se muestran las primeras ${resumen.errores.length})` : ""}
              </p>
              <ul className="max-h-64 divide-y overflow-y-auto text-sm">
                {resumen.errores.map((e, i) => (
                  <li key={i} className="px-4 py-2">
                    <span className="font-mono text-xs font-semibold">fila {e.fila}:</span> {e.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
