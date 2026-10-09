"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ERROR_CUENTA_BLOQUEADA, MAX_INTENTOS, MINUTOS_BLOQUEO } from "@/lib/seguridad/bloqueo";

const esquema = z.object({
  email: z.string().min(1, "Escribe tu correo").email("Correo no válido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});
type Datos = z.infer<typeof esquema>;

export function FormularioLogin({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  async function onSubmit(datos: Datos) {
    setError(null);
    const res = await signIn("credentials", { ...datos, redirect: false });
    if (!res || res.error) {
      setError(
        res?.error === ERROR_CUENTA_BLOQUEADA
          ? `Por seguridad, la cuenta quedó bloqueada ${MINUTOS_BLOQUEO} minutos tras ${MAX_INTENTOS} intentos fallidos. Intenta más tarde o contacta al administrador.`
          : "Correo o contraseña incorrectos, o la cuenta está inactiva.",
      );
      return;
    }
    // La raíz decide el módulo inicial según el rol
    // Solo rutas internas "/algo": se rechazan "//sitio" y "/\\sitio", que el navegador trata como otro dominio (redirección abierta)
    const destino = callbackUrl && /^\/(?![\/\\])/.test(callbackUrl) ? callbackUrl : "/";
    router.push(destino);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="space-y-2">
        <Label htmlFor="email">Correo institucional</Label>
        <Input id="email" type="email" autoComplete="username" placeholder="nombre@ucc.edu.co" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </Button>
    </form>
  );
}
