/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint se corre por separado con `npm run lint`; no bloquea el build de producción
    ignoreDuringBuilds: true,
  },
  typescript: {
    // El type-check se corre con `npm run type-check`; no bloquea el build
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
