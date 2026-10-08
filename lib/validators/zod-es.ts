import { z, ZodIssueCode, type ZodErrorMap } from "zod";

/**
 * Mensajes de error de Zod en español para los casos que no tienen un mensaje propio.
 * Se registra una sola vez al importar este módulo (lo importan todos los validadores).
 */
const mapaErrores: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined") return { message: "Este campo es obligatorio" };
      return { message: `Tipo de dato inválido: se esperaba ${issue.expected}` };
    case ZodIssueCode.too_small:
      if (issue.type === "string") return { message: `Debe tener al menos ${issue.minimum} caracteres` };
      if (issue.type === "array") return { message: `Debe tener al menos ${issue.minimum} elementos` };
      return { message: `Debe ser mayor ${issue.inclusive ? "o igual " : ""}que ${issue.minimum}` };
    case ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Debe tener máximo ${issue.maximum} caracteres` };
      if (issue.type === "array") return { message: `Debe tener máximo ${issue.maximum} elementos` };
      return { message: `Debe ser menor ${issue.inclusive ? "o igual " : ""}que ${issue.maximum}` };
    case ZodIssueCode.invalid_enum_value:
      return { message: `Valor no permitido. Opciones: ${issue.options.join(", ")}` };
    case ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Correo electrónico no válido" };
      if (issue.validation === "uuid") return { message: "Identificador no válido" };
      return { message: "Texto con formato no válido" };
    case ZodIssueCode.not_finite:
      return { message: "Debe ser un número finito" };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(mapaErrores);

export {};
