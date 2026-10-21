import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Select nativo con estilos de shadcn/ui.
 * Decisión: se usa el <select> del navegador (accesible, funciona bien en móvil y sin
 * dependencias de Radix) en lugar del Select de Radix, que es más pesado para filtros simples.
 */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
