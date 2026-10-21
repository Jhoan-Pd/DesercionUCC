import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-lg border p-4 text-sm leading-relaxed", {
  variants: {
    variant: {
      info: "border-bruma bg-[#EEF3F6] text-marino",
      success: "border-riesgo-bajo-borde bg-riesgo-bajo-fondo text-riesgo-bajo",
      warning: "border-riesgo-medio-borde bg-riesgo-medio-fondo text-riesgo-medio",
      error: "border-riesgo-alto-borde bg-riesgo-alto-fondo text-riesgo-alto",
    },
  },
  defaultVariants: { variant: "info" },
});

const iconos = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertTriangle };

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof alertVariants> {
  titulo?: string;
}

export function Alert({ className, variant = "info", titulo, children, ...props }: AlertProps) {
  const Icono = iconos[variant ?? "info"];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
