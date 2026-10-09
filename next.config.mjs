/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma debe ejecutarse en el runtime de Node (no Edge)
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"] },
};
export default nextConfig;
