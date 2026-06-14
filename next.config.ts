import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow LAN access during local development (ignored in production)
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['172.20.10.3'],
  }),

  // Include SQLite file in all API route serverless function bundles.
  // Without this, Vercel's file-tracing omits the .sqlite file
  // (it's not an explicit import, so the bundler doesn't detect it automatically).
  outputFileTracingIncludes: {
    '/api/**/*': ['./db/entitlements.sqlite'],
  },
};

export default nextConfig;
