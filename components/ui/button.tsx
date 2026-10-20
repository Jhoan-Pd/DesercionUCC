import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-grafito",
        accent: "bg-accent text-accent-foreground hover:bg-pino",
        outline: "border border-tinta/30 bg-card text-tinta hover:border-tinta",
        ghost: "text-grafito hover:bg-secondary hover:text-tinta",
        destructive: "bg-destructive text-destructive-foreground hover:bg-riesgo-alto",
      },
      size: { default: "h-10 px-5 py-2", sm: "h-8 px-3 text-[11px]", lg: "h-11 px-7" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
