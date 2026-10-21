import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ServicioUsuarios } from "@/services/usuarios/ServicioUsuarios";
import { Encabezado } from "@/components/comunes/Encabezado";
import { GestorUsuarios } from "@/components/usuarios/GestorUsuarios";

export const metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  const usuarios = await new ServicioUsuarios().listar();
  return (
    <>
      <Encabezado
        seccion="/usuarios"
        titulo="quién tiene acceso."
        descripcion="Cuentas del personal autorizado. El Administrador carga los datos y gestiona las cuentas; Bienestar consulta el riesgo y usa el agente."
      />
      <GestorUsuarios usuarios={usuarios} actualId={session?.user.id ?? ""} />
    </>
  );
}
