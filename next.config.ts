import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Baileys requires Node.js specific features - server only
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'pino-pretty'],
  // Skip TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // @ts-ignore
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
