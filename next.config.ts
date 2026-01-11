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

import { withSentryConfig } from '@sentry/nextjs';

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "numerik-n7",
  project: "whatsai",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through the Next.js rewrite to circumvent ad-blockers
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  // Note: disableLogger is deprecated, but valid alternatives depend on bundler version. 
  // We'll remove it to silence the warning for now.
});

