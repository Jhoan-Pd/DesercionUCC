/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma, ExcelJS y jsPDF se cargan desde node_modules en el servidor (runtime de Node, no Edge)
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "exceljs", "jspdf", "jspdf-autotable"] },
};
export default nextConfig;
