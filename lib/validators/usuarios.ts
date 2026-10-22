import { z } from "zod";
import "./zod-es";
import { ROLES } from "@/lib/roles";

export const contrasenaSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña debe tener máximo 72 caracteres")
  .regex(/[a-zA-Z]/, "La contraseña debe tener letras")
  .regex(/\d/, "La contraseña debe tener números");

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email(),
  rol: z.enum(ROLES),
  password: contrasenaSchema,
});

export const actualizarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(3).max(120).optional(),
    rol: z.enum(ROLES).optional(),
    activo: z.boolean().optional(),
    password: contrasenaSchema.optional(),
    desbloquear: z.literal(true).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No hay cambios para guardar" });

export type CrearUsuario = z.infer<typeof crearUsuarioSchema>;
export type ActualizarUsuario = z.infer<typeof actualizarUsuarioSchema>;
