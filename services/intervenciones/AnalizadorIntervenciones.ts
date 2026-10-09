/**
 * ¿Funcionan las intervenciones de Bienestar?
 *
 * Unidad: estudiante-semestre (desde que existe el programa de acompañamiento) con desenlace
 * conocido. Resultado: PERMANECIÓ = no desertó al terminar ese semestre ni el siguiente.
 *
 * Problema metodológico (para sustentar): Bienestar interviene a quienes tienen MÁS riesgo, así que
 * comparar "intervenidos vs. no intervenidos" a secas castiga a la intervención (sesgo de selección).
 * Solución: ESTRATIFICAR por la probabilidad de deserción que estima el modelo y comparar dentro de
 * cada franja de riesgo; luego se promedian las diferencias ponderando por el número de intervenidos
 * (efecto promedio en los tratados, ATT). El intervalo de confianza del 95 % usa la aproximación
 * normal de la diferencia de proporciones.
 *
 * Es una clase pura (sin BD): se prueba con casos construidos a mano.
 */

export type TipoIntervencionAnalisis = "TUTORIA" | "APOYO_ECONOMICO" | "ACOMPANAMIENTO_PSICOLOGICO" | "ORIENTACION_VOCACIONAL" | "OTRO";

export interface Observacion {
  /** Probabilidad de desertar que estimó el modelo para ese semestre */
  probabilidad: number;
  intervenido: boolean;
  tipo: TipoIntervencionAnalisis | null;
  permanecio: boolean;
  /** Código del periodo ("2024-1") */
  periodo: string;
}

export interface Grupo {
  n: number;
  permanecieron: number;
  /** % que permaneció */
  tasa: number;
}

export interface FilaEstrato {
  franja: string;
  tratados: Grupo;
  controles: Grupo;
  /** Diferencia de permanencia en puntos porcentuales (null si falta alguno de los grupos) */
  diferencia: number | null;
}

export interface ResultadoComparacion {
  tratados: Grupo;
  /** Todos los no intervenidos (comparación ingenua) */
  controles: Grupo;
  diferenciaIngenua: number;
  /** Efecto ajustado por riesgo, en puntos porcentuales (null si no hay estratos comparables) */
  efectoAjustado: number | null;
  ic95: [number, number] | null;
  significativo: boolean;
  /** Intervenidos que entraron en el ajuste (los de franjas sin controles quedan fuera) */
  tratadosComparables: number;
  estratos: FilaEstrato[];
}

export interface FilaCobertura {
  periodo: string;
  enRiesgo: number;
  intervenidos: number;
  cobertura: number;
}

export interface ResultadoEfectividad {
  observaciones: number;
  general: ResultadoComparacion;
  porTipo: (ResultadoComparacion & { tipo: TipoIntervencionAnalisis })[];
  cobertura: FilaCobertura[];
  interpretacion: string[];
}

export const FRANJAS: { desde: number; hasta: number; etiqueta: string }[] = [
  { desde: 0, hasta: 0.05, etiqueta: "< 5 %" },
  { desde: 0.05, hasta: 0.11, etiqueta: "5-11 %" },
  { desde: 0.11, hasta: 0.2, etiqueta: "11-20 %" },
  { desde: 0.2, hasta: 0.3, etiqueta: "20-30 %" },
  { desde: 0.3, hasta: 0.45, etiqueta: "30-45 %" },
  { desde: 0.45, hasta: 1.0001, etiqueta: "≥ 45 %" },
];

const TIPOS: TipoIntervencionAnalisis[] = ["APOYO_ECONOMICO", "TUTORIA", "ACOMPANAMIENTO_PSICOLOGICO", "ORIENTACION_VOCACIONAL"];
const redondear = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

function grupo(obs: Observacion[]): Grupo {
  const permanecieron = obs.filter((o) => o.permanecio).length;
  return { n: obs.length, permanecieron, tasa: obs.length ? redondear((100 * permanecieron) / obs.length) : 0 };
}

export class AnalizadorIntervenciones {
  /**
   * @param minimoPorGrupo  tamaño mínimo de tratados y controles para usar una franja en el ajuste
   * @param umbralRiesgo    probabilidad desde la que un estudiante cuenta como "en riesgo" (cobertura)
   */
  constructor(
    private readonly minimoPorGrupo = 5,
    private readonly umbralRiesgo = 0.11,
  ) {}

  analizar(observaciones: Observacion[]): ResultadoEfectividad {
    const controles = observaciones.filter((o) => !o.intervenido);
    const general = this.comparar(observaciones.filter((o) => o.intervenido), controles);
    const porTipo = TIPOS.map((tipo) => ({ tipo, ...this.comparar(observaciones.filter((o) => o.intervenido && o.tipo === tipo), controles) })).filter(
      (t) => t.tratados.n > 0,
    );
    return {
      observaciones: observaciones.length,
      general,
      porTipo,
      cobertura: this.cobertura(observaciones),
      interpretacion: this.interpretar(general, porTipo),
    };
  }

  /** Compara un grupo de intervenidos contra los no intervenidos, a secas y ajustando por riesgo */
  comparar(tratados: Observacion[], controles: Observacion[]): ResultadoComparacion {
    const gT = grupo(tratados);
    const gC = grupo(controles);
    const estratos: FilaEstrato[] = FRANJAS.map((f) => {
      const enFranja = (o: Observacion) => o.probabilidad >= f.desde && o.probabilidad < f.hasta;
      const t = grupo(tratados.filter(enFranja));
      const c = grupo(controles.filter(enFranja));
      return { franja: f.etiqueta, tratados: t, controles: c, diferencia: t.n && c.n ? redondear(t.tasa - c.tasa) : null };
    });

    // ATT: promedio de diferencias por franja, ponderado por el número de tratados de la franja
    const usables = estratos.filter((e) => e.tratados.n >= this.minimoPorGrupo && e.controles.n >= this.minimoPorGrupo);
    const peso = usables.reduce((s, e) => s + e.tratados.n, 0);
    let efecto: number | null = null;
    let ic: [number, number] | null = null;
    if (peso > 0) {
      let suma = 0;
      let varianza = 0;
      for (const e of usables) {
        const pT = e.tratados.permanecieron / e.tratados.n;
        const pC = e.controles.permanecieron / e.controles.n;
        const w = e.tratados.n / peso;
        suma += w * (pT - pC);
        varianza += w * w * ((pT * (1 - pT)) / e.tratados.n + (pC * (1 - pC)) / e.controles.n);
      }
      const ee = Math.sqrt(varianza);
      efecto = redondear(100 * suma);
      ic = [redondear(100 * (suma - 1.96 * ee)), redondear(100 * (suma + 1.96 * ee))];
    }
    return {
      tratados: gT,
      controles: gC,
      diferenciaIngenua: redondear(gT.tasa - gC.tasa),
      efectoAjustado: efecto,
      ic95: ic,
      significativo: ic !== null && (ic[0] > 0 || ic[1] < 0),
      tratadosComparables: peso,
      estratos,
    };
  }

  /** Por periodo: cuántos estudiantes en riesgo hubo y a cuántos se intervino */
  cobertura(observaciones: Observacion[]): FilaCobertura[] {
    const porPeriodo = new Map<string, { enRiesgo: number; intervenidos: number }>();
    for (const o of observaciones) {
      const fila = porPeriodo.get(o.periodo) ?? { enRiesgo: 0, intervenidos: 0 };
      if (o.probabilidad >= this.umbralRiesgo || o.intervenido) fila.enRiesgo++;
      if (o.intervenido) fila.intervenidos++;
      porPeriodo.set(o.periodo, fila);
    }
    return [...porPeriodo.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([periodo, f]) => ({ periodo, ...f, cobertura: f.enRiesgo ? redondear((100 * f.intervenidos) / f.enRiesgo) : 0 }));
  }

  private interpretar(g: ResultadoComparacion, porTipo: (ResultadoComparacion & { tipo: TipoIntervencionAnalisis })[]): string[] {
    const pp = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("es-CO", { maximumFractionDigits: 1 })} pp`;
    const textos: string[] = [];
    if (g.tratados.n === 0) return ["Aún no hay intervenciones con desenlace conocido para evaluar."];
    textos.push(
      `Sin ajustar, los intervenidos permanecieron ${g.tratados.tasa.toLocaleString("es-CO")} % frente a ${g.controles.tasa.toLocaleString("es-CO")} % de los no intervenidos (${pp(g.diferenciaIngenua)}). Esta comparación es injusta: Bienestar atiende a quienes tienen más riesgo.`,
    );
    if (g.efectoAjustado !== null && g.ic95) {
      textos.push(
        `Comparando con estudiantes de riesgo similar, la intervención se asocia a ${pp(g.efectoAjustado)} de permanencia (IC 95 %: ${pp(g.ic95[0])} a ${pp(g.ic95[1])})${g.significativo ? ", una diferencia estadísticamente significativa" : "; el intervalo incluye el cero, así que aún no es concluyente"}.`,
      );
    }
    const conEfecto = porTipo.filter((t) => t.efectoAjustado !== null).sort((a, b) => (b.efectoAjustado ?? 0) - (a.efectoAjustado ?? 0));
    if (conEfecto.length > 1) {
      const nombre: Record<string, string> = { APOYO_ECONOMICO: "el apoyo económico", TUTORIA: "las tutorías", ACOMPANAMIENTO_PSICOLOGICO: "el acompañamiento psicológico", ORIENTACION_VOCACIONAL: "la orientación vocacional", OTRO: "otras acciones" };
      textos.push(`La intervención con mayor efecto estimado es ${nombre[conEfecto[0].tipo]} (${pp(conEfecto[0].efectoAjustado ?? 0)}); la de menor, ${nombre[conEfecto[conEfecto.length - 1].tipo]} (${pp(conEfecto[conEfecto.length - 1].efectoAjustado ?? 0)}).`);
    }
    textos.push("Es un análisis observacional: muestra asociación, no causalidad. Variables que el modelo no ve (motivación, apoyo familiar) pueden influir.");
    return textos;
  }
}
