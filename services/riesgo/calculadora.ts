import { puntajePorFactores, type MetodoRiesgo, type ResultadoRiesgo } from "./factores";
import { predecirConModelo, type DefinicionModelo } from "./modelo";
import type { DatosEstudiante } from "./variables";

/**
 * Patrón Strategy: hay dos formas de calcular el riesgo y quien las usa no necesita saber cuál está
 * vigente. Las dos devuelven el mismo ResultadoRiesgo (puntaje, nivel, factores y datos faltantes),
 * así que la lista, la ficha, el agente y la explicación funcionan igual con cualquiera.
 */
export interface CalculadoraRiesgo {
  readonly metodo: MetodoRiesgo;
  /** Versión del modelo (null para el puntaje por factores, que no se entrena) */
  readonly version: string | null;
  evaluar(datos: DatosEstudiante): ResultadoRiesgo;
}

/** Puntaje de alerta por factores documentados (MEN-SPADIES): se usa mientras no haya un modelo con datos de la UCC */
export class CalculadoraPorFactores implements CalculadoraRiesgo {
  readonly metodo = "FACTORES" as const;
  readonly version = null;

  evaluar(datos: DatosEstudiante): ResultadoRiesgo {
    return puntajePorFactores(datos);
  }
}

/** Regresión logística entrenada con estudiantes de la UCC que ya se retiraron o se graduaron */
export class CalculadoraModelo implements CalculadoraRiesgo {
  readonly metodo = "MODELO" as const;

  constructor(private readonly definicion: DefinicionModelo) {}

  get version(): string {
    return this.definicion.version;
  }

  evaluar(datos: DatosEstudiante): ResultadoRiesgo {
    return predecirConModelo(this.definicion, datos);
  }
}

/** Fábrica: el modelo activo si existe; si no, el puntaje por factores */
export function crearCalculadora(modelo: DefinicionModelo | null): CalculadoraRiesgo {
  return modelo ? new CalculadoraModelo(modelo) : new CalculadoraPorFactores();
}
