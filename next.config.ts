import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Répertoire de build paramétrable : deploy.sh construit dans .next_new
  // pendant que le serveur continue de servir .next (zero-downtime réel).
  // Au runtime (next start), NEXT_DIST_DIR n'est pas défini → '.next'.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactCompiler: true,
  // Baileys requires Node.js specific features - server only
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'pino-pretty', 'pdf-parse', 'pdfjs-dist', 'word-extractor', 'yauzl'],
  // TypeScript checking enabled for security
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'play.google.com' },
    ],
  },
  async headers() {
    return [
      // Public REST API — open CORS (auth via API key, not cookies)
      // Les routes internes n'ont pas besoin de CORS explicite :
      // elles sont protégées par same-origin + cookie-based auth.
      {
        source: '/api/public/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Api-Key' },
        ],
      },
    ]
  },
};

import { withSentryConfig } from '@sentry/nextjs';

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG ?? "numerik-n7",
  project: process.env.SENTRY_PROJECT ?? "wazzapai",

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

