import { manejar, leerJson } from "@/lib/api";
import { crearUsuarioSchema } from "@/lib/validators/usuarios";
import { ServicioUsuarios } from "@/services/usuarios/ServicioUsuarios";

export const GET = manejar(["ADMIN"], async () => ({ usuarios: await new ServicioUsuarios().listar() }));

export const POST = manejar(["ADMIN"], async ({ req }) => new ServicioUsuarios().crear(await leerJson(req, crearUsuarioSchema)));
