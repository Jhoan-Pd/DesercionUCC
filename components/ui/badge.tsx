import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]", {
  variants: {
    variant: {
      default: "bg-bruma text-marino",
      success: "bg-riesgo-bajo-fondo text-riesgo-bajo",
      warning: "bg-riesgo-medio-fondo text-riesgo-medio",
      danger: "bg-riesgo-alto-fondo text-riesgo-alto",
      muted: "bg-secondary text-grafito",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
