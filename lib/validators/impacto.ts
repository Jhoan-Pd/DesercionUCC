import { z } from "zod";
import "./zod-es";

const dinero = (etiqueta: string) =>
  z
    .number({ invalid_type_error: `${etiqueta} debe ser un número`, required_error: `${etiqueta} es obligatorio` })
    .finite()
    .min(0, `${etiqueta} no puede ser negativo`)
    .max(2_000_000_000, `${etiqueta} es demasiado alto`);

export const entradaImpactoSchema = z
  .object({
    programa: z.object({
      nombre: z.string().min(1).max(120),
      duracionSemestres: z.number().int().min(1, "La duración debe ser de al menos 1 semestre").max(16),
      valorSemestre: dinero("El valor del semestre"),
    }),
    semestresCursados: z.number().int().min(0, "Los semestres cursados no pueden ser negativos").max(16),
    /** Suma real de matrículas pagadas, si se conoce; si no, se estima como valorSemestre × semestres */
    matriculaTotalPagada: dinero("La matrícula total pagada").optional(),
    transporteMensual: dinero("El transporte mensual"),
    materialesSemestre: dinero("El valor de materiales por semestre"),
    sostenimientoMensual: dinero("El sostenimiento mensual"),
    financiacion: z.object({
      tipo: z.enum(["RECURSOS_PROPIOS", "ICETEX", "BECA", "CREDITO_UCC"]),
      porcentajeFinanciado: z.number().min(0).max(100),
      /** Deuda vigente; si no se envía, se estima a partir de la matrícula financiada */
      saldoDeuda: dinero("El saldo de la deuda").optional(),
      tasaEA: z.number().min(0, "La tasa no puede ser negativa").max(1, "Ingresa la tasa como fracción (0.11 = 11%)"),
      plazoMeses: z.number().int().min(0).max(240),
    }),
    salarioProfesionalMensual: dinero("El salario profesional"),
    nivelAlternativo: z.enum(["BACHILLER", "TECNICO", "TECNOLOGO"]),
    /** Ingreso mensual que el estudiante recibe hoy mientras estudia (0 si no trabaja) */
    ingresoMensualActual: dinero("El ingreso mensual actual"),
  })
  .refine((v) => v.semestresCursados <= v.programa.duracionSemestres, {
    message: "Los semestres cursados no pueden superar la duración del programa",
    path: ["semestresCursados"],
  })
  .refine(
    (v) => !["ICETEX", "CREDITO_UCC"].includes(v.financiacion.tipo) || v.financiacion.porcentajeFinanciado === 0 || v.financiacion.plazoMeses >= 1,
    { message: "Con crédito educativo, el plazo de pago debe ser de al menos 1 mes", path: ["financiacion", "plazoMeses"] },
  );

export type EntradaImpactoInput = z.infer<typeof entradaImpactoSchema>;

export const perfilImpactoQuerySchema = z.object({
  programaId: z.string().uuid("Programa inválido").optional(),
  codigo: z.string().min(3).max(30).optional(),
});
