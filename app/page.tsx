import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rutaInicial } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** La raíz solo redirige: a /login sin sesión, o al módulo inicial del rol */
export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.revocada) redirect("/login?motivo=cuenta-desactivada");
  redirect(rutaInicial(session.user.rol));
}
