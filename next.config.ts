import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Répertoire de build paramétrable : deploy.sh construit dans .next_new
  // pendant que le serveur continue de servir .next (zero-downtime réel).
  // Au runtime (next start), NEXT_DIST_DIR n'est pas défini → '.next'.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactCompiler: true,
  // Sécurité (audit F-02) : ne pas divulguer la stack via l'en-tête X-Powered-By.
  poweredByHeader: false,
  // Baileys requires Node.js specific features - server only
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'pino-pretty', 'pdf-parse', 'pdfjs-dist', 'word-extractor', 'yauzl'],
  // TypeScript checking enabled for security
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'play.google.com' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
  async headers() {
    // Sécurité (audit F-02) : en-têtes de sécurité appliqués à toutes les réponses.
    // La CSP est volontairement livrée en "Report-Only" pour ne rien casser en
    // production : elle ne bloque rien mais fait remonter les violations, afin de
    // pouvoir l'affiner puis la passer en Content-Security-Policy stricte ensuite.
    const securityHeaders = [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
      },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      {
        // Report-Only : n'applique aucun blocage, sert à observer les violations.
        key: 'Content-Security-Policy-Report-Only',
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'self'",
          "form-action 'self'",
          // Next.js requiert l'inline pour ses scripts d'hydratation ; GA/GTM et Sentry externes.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.googleapis.com",
          "media-src 'self' data: blob:",
        ].join('; '),
      },
    ]

    return [
      // En-têtes de sécurité sur toutes les pages/routes.
      {
        source: '/:path*',
        headers: securityHeaders,
      },
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

