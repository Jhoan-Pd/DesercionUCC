import type { Config } from "tailwindcss";

/**
 * Estilo editorial: fondo papel, tinta grafito, títulos en serif (Cormorant Garamond),
 * texto en Manrope y detalles en monoespaciada. Los colores de acento son apagados
 * (petróleo, pino, salvia, marino) y se reservan para datos y estados.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Manrope Variable"', "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"SF Mono"', '"Fira Code"', "Consolas", "ui-monospace", "monospace"],
      },
      colors: {
        // Neutros
        tinta: "#303030",
        grafito: "#505050",
        piedra: "#6E6E6E",
        papel: "#F9F9F9",
        // Acentos
        petroleo: "#2B7983",
        pino: "#234F46",
        salvia: "#84A98C",
        marino: "#234F65",
        coral: "#D91642",
        // Fondos pastel para etiquetas y avisos
        bruma: "#DCE6ED",
        hoja: "#E7EDE8",
        agua: "#C8DBD7",
        // Niveles de riesgo (fondo, texto y borde), siempre acompañados de texto e ícono
        riesgo: {
          "alto-fondo": "#F7E1E6",
          alto: "#9E1235",
          "alto-borde": "#EDC2CC",
          "medio-fondo": "#F4EBD9",
          medio: "#7A5410",
          "medio-borde": "#E5D2AA",
          "bajo-fondo": "#E7EDE8",
          bajo: "#234F46",
          "bajo-borde": "#C8DBD7",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { xl: "18px", lg: "12px", md: "8px", sm: "3px" },
      letterSpacing: { ceja: "0.15em" },
      boxShadow: { suave: "0 6px 16px rgba(48, 48, 48, 0.08)" },
    },
  },
  plugins: [],
};
export default config;
