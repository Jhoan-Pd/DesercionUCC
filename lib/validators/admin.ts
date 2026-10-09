import { z } from "zod";
import "./zod-es";

const dinero = (etiqueta: string) =>
  z.number({ invalid_type_error: `${etiqueta} debe ser un número` }).int(`${etiqueta} debe ser un número entero`).min(0, `${etiqueta} no puede ser negativo`).max(200_000_000);

// ---------------------------------------------------------------- Programas
export const programaSchema = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(120),
  facultad: z.string().trim().min(3, "La facultad debe tener al menos 3 caracteres").max(120),
  duracionSemestres: z.number().int().min(1, "Mínimo 1 semestre").max(16, "Máximo 16 semestres"),
  valorSemestre: dinero("El valor del semestre"),
  /** Salario de enganche del egresado (crea o actualiza el parámetro propio del programa) */
  salarioEnganche: dinero("El salario de enganche").optional(),
  activo: z.boolean().default(true),
});
export const programaParcialSchema = programaSchema.partial().refine((v) => Object.keys(v).length > 0, "Envía al menos un campo para actualizar");
export type DatosPrograma = z.infer<typeof programaSchema>;
export type CambiosPrograma = z.infer<typeof programaParcialSchema>;

// ---------------------------------------------------------------- Periodos
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Fecha inválida");

export const periodoSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  semestre: z.union([z.literal(1), z.literal(2)], { errorMap: () => ({ message: "El semestre debe ser 1 o 2" }) }),
  fechaInicio: fecha,
  fechaFin: fecha,
  activo: z.boolean().default(false),
});
export const cambiosPeriodoSchema = z
  .object({ fechaInicio: fecha, fechaFin: fecha, activo: z.literal(true) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Envía al menos un campo para actualizar");
export type DatosPeriodo = z.infer<typeof periodoSchema>;
export type CambiosPeriodo = z.infer<typeof cambiosPeriodoSchema>;

// ---------------------------------------------------------------- Usuarios
const rol = z.enum(["ADMIN", "BIENESTAR", "DOCENTE", "ESTUDIANTE"], { errorMap: () => ({ message: "Rol no válido" }) });
const contrasena = z.string().min(1, "Escribe una contraseña").max(100);

export const crearUsuarioSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Correo no válido").max(120),
    nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(120),
    rol,
    contrasena,
    /** Obligatorio para ESTUDIANTE: enlaza la cuenta con su registro académico */
    codigoEstudiante: z.string().trim().toUpperCase().max(30).optional(),
  })
  .refine((v) => v.rol !== "ESTUDIANTE" || !!v.codigoEstudiante, { message: "Para el rol ESTUDIANTE indica el código del estudiante", path: ["codigoEstudiante"] });

export const actualizarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(3).max(120),
    rol,
    activo: z.boolean(),
    codigoEstudiante: z.string().trim().toUpperCase().max(30).nullable(),
    /** Restablece la contraseña (la persona debería cambiarla al ingresar) */
    contrasena,
    /** Quita el bloqueo por intentos fallidos */
    desbloquear: z.literal(true),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Envía al menos un campo para actualizar");

export const filtrosUsuariosSchema = z.object({
  rol: rol.optional(),
  estado: z.enum(["activos", "inactivos", "bloqueados"]).optional(),
  busqueda: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

export type CrearUsuario = z.infer<typeof crearUsuarioSchema>;
export type ActualizarUsuario = z.infer<typeof actualizarUsuarioSchema>;
export type FiltrosUsuarios = z.infer<typeof filtrosUsuariosSchema>;
