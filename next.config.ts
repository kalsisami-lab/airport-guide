import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow LAN access during local development (ignored in production)
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['172.20.10.3'],
  }),
};

export default nextConfig;
