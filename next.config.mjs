/**
 * Cabeceras de seguridad para todas las respuestas:
 * - la página no se puede incrustar en otro sitio (clickjacking): X-Frame-Options y frame-ancestors;
 * - el navegador no adivina tipos de archivo (nosniff) ni envía la URL completa a otros sitios;
 * - se niegan cámara, micrófono, ubicación y pagos, que la aplicación no usa.
 * No se fija una CSP de scripts porque Next.js inyecta scripts en línea al hidratar la página.
 */
const cabecerasSeguridad = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma y ExcelJS se cargan desde node_modules en el servidor (runtime de Node, no Edge)
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "exceljs"] },
  async headers() {
    return [
      { source: "/:path*", headers: cabecerasSeguridad },
      // Las respuestas de la API traen datos personales (Ley 1581): ningún navegador ni proxy las guarda
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};
export default nextConfig;
