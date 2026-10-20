import type { Metadata } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Observatorio de Deserción UCC", template: "%s · Observatorio de Deserción UCC" },
  description: "Detecta a tiempo a los estudiantes que podrían retirarse, con datos reales y un agente de IA — Universidad Cooperativa de Colombia, sede Pasto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
