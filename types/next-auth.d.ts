import type { DefaultSession } from "next-auth";
import type { Rol } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    /** true si la cuenta fue desactivada o eliminada después de iniciar sesión */
    revocada?: boolean;
    user: {
      id: string;
      rol: Rol;
      estudianteId: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    rol: Rol;
    estudianteId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    rol: Rol;
    estudianteId: string | null;
    revocada?: boolean;
  }
}
