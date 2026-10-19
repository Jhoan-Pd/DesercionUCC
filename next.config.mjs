/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma y ExcelJS se cargan desde node_modules en el servidor (runtime de Node, no Edge)
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "exceljs"] },
};
export default nextConfig;
