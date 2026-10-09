/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * Se usa en el seed para que los datos sintéticos sean REPRODUCIBLES:
 * la misma semilla produce exactamente el mismo dataset (útil para tests y sustentación).
 */
export class Aleatorio {
  private estado: number;

  constructor(semilla: number) {
    this.estado = semilla >>> 0;
  }

  /** Número uniforme en [0, 1) */
  siguiente(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Normal estándar (Box-Muller) */
  normal(media = 0, desv = 1): number {
    const u = Math.max(this.siguiente(), 1e-12);
    const v = this.siguiente();
    return media + desv * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Entero uniforme en [min, max] (ambos incluidos) */
  entero(min: number, max: number): number {
    return Math.floor(this.siguiente() * (max - min + 1)) + min;
  }

  bernoulli(p: number): boolean {
    return this.siguiente() < p;
  }

  elegir<T>(lista: readonly T[]): T {
    return lista[Math.floor(this.siguiente() * lista.length)];
  }

  /** Elige un elemento con probabilidad proporcional a su peso */
  ponderado<T>(items: readonly T[], pesos: readonly number[]): T {
    const total = pesos.reduce((a, b) => a + b, 0);
    let r = this.siguiente() * total;
    for (let i = 0; i < items.length; i++) {
      r -= pesos[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Uniforme en [min, max) */
  rango(min: number, max: number): number {
    return min + this.siguiente() * (max - min);
  }
}

export const sigmoide = (z: number): number => 1 / (1 + Math.exp(-z));
export const acotar = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));
