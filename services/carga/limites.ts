/**
 * Límites de la carga de archivos. Módulo sin dependencias para que lo usen tanto el servidor
 * (ServicioCarga) como el formulario del navegador (que avisa antes de subir un archivo muy grande).
 */
export const TAMANO_MAXIMO_MB = 5;
export const TAMANO_MAXIMO = TAMANO_MAXIMO_MB * 1024 * 1024;
