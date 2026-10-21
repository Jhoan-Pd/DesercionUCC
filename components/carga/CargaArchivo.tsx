"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

interface Resumen {
  archivo: string;
  filas: number;
  nuevos: number;
  actualizados: number;
  errores: { fila: number; mensaje: string }[];
  totalErrores: number;
  ignoradas: string[];
  modelo: { estado: "INSUFICIENTE" | "ACTIVADO" | "NO_ACTIVADO"; motivo: string };
  evaluados: number;
}

const n = (v: number) => v.toLocaleString("es-CO");

/** Subida del archivo de estudiantes (.xlsx o .csv) y resumen del resultado */
export function CargaArchivo() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  async function subir() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setResumen(null);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      const res = await fetch("/api/cargas", { method: "POST", body: datos });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el archivo.");
      setResumen(json as Resumen);
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
        <span className="meta">{archivo ? `${(archivo.size / 1024).toLocaleString("es-CO", { maximumFractionDigits: 0 })} KB` : "Excel (.xlsx) o CSV · máximo 5 MB"}</span>
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
              {n(resumen.nuevos)} estudiantes nuevos y {n(resumen.actualizados)} actualizados. Se calculó el riesgo de {n(resumen.evaluados)} estudiantes activos.
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
                {n(resumen.totalErrores)} filas no se cargaron{resumen.totalErrores > resumen.errores.length ? ` (se muestran las primeras ${resumen.errores.length})` : ""}
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
