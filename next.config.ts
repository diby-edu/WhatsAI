import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Baileys requires Node.js specific features - server only
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'pino-pretty'],
  // Skip TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);

