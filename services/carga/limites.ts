/**
 * Límites de la carga de archivos. Módulo sin dependencias para que lo usen tanto el servidor
 * (ServicioCarga) como el formulario del navegador (que avisa antes de subir un archivo muy grande).
 */
export const TAMANO_MAXIMO_MB = 5;
export const TAMANO_MAXIMO = TAMANO_MAXIMO_MB * 1024 * 1024;

/**
 * Largo máximo de los textos libres del archivo. Los mismos límites usan los filtros de la URL, así un
 * enlace a «/estudiantes?programa=…» nunca trae un programa que el filtro rechace. También acotan lo
 * que llega a los mensajes del agente de IA.
 */
export const LARGO_MAXIMO = { codigo: 40, nombre: 150, programa: 120, periodo: 20 } as const;
