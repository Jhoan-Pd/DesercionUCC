/**
 * Web Worker: lee y valida el archivo de estudiantes EN EL NAVEGADOR, en un hilo aparte.
 *
 * Leer un Excel de miles de filas tarda cientos de milisegundos; en el hilo principal la página
 * quedaría congelada (sin clics ni animaciones). Aquí corre en paralelo y la página solo recibe la
 * vista previa. Usa las MISMAS funciones que el servidor (services/carga/archivo y lector), así lo que
 * se ve antes de subir coincide con lo que pasará al cargar. El servidor vuelve a validar todo: la
 * vista previa es una ayuda, no un control de seguridad. El archivo no sale del equipo en este paso.
 */
import { ErrorArchivo, formatoDe, leerTabla } from "@/services/carga/archivo";
import { COLUMNAS, validarTabla } from "@/services/carga/lector";
import { MAX_ERRORES_VISTA, type PedidoValidacion, type RespuestaValidacion } from "./protocolo-validacion";

/** Ámbito del worker (se tipa a mano porque el proyecto compila con las librerías del DOM) */
const ambito = self as unknown as {
  onmessage: ((evento: MessageEvent<PedidoValidacion>) => void) | null;
  postMessage(mensaje: RespuestaValidacion): void;
};

ambito.onmessage = async ({ data: { id, nombre, buffer } }) => {
  const inicio = performance.now();
  try {
    const formato = formatoDe(nombre);
    if (!formato) throw new ErrorArchivo("Formato no admitido. Elige un archivo .xlsx o .csv (puedes partir de la plantilla).");
    ambito.postMessage({ id, tipo: "progreso", etapa: "leyendo" });
    const tabla = await leerTabla(nombre, buffer);
    ambito.postMessage({ id, tipo: "progreso", etapa: "validando" });
    const r = validarTabla(tabla);

    const estados = { ACTIVO: 0, RETIRADO: 0, GRADUADO: 0 };
    for (const e of r.estudiantes) estados[e.estado]++;
    const presentes = new Set(r.columnas);
    ambito.postMessage({
      id,
      tipo: "lista",
      vista: {
        formato,
        filas: r.estudiantes.length + r.errores.filter((e) => e.fila > 1).length,
        validas: r.estudiantes.length,
        conError: r.errores.length,
        errores: r.errores.slice(0, MAX_ERRORES_VISTA),
        ignoradas: r.ignoradas,
        sinColumna: COLUMNAS.filter((c) => !c.obligatoria && !presentes.has(c.campo)).map((c) => c.alias[0]),
        estados,
        milisegundos: Math.round(performance.now() - inicio),
      },
    });
  } catch (e) {
    ambito.postMessage({ id, tipo: "error", mensaje: e instanceof ErrorArchivo ? e.message : "No se pudo revisar el archivo en el navegador; puedes subirlo igual y el servidor lo validará." });
  }
};
