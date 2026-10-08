import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Observatorio de Deserción UCC", template: "%s · Observatorio de Deserción UCC" },
  description: "Mide el impacto de desertar de los estudios y detecta estudiantes en riesgo — Universidad Cooperativa de Colombia, sede Pasto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
