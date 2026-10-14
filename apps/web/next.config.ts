import type { NextConfig } from 'next';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: new URL('../../.env', import.meta.url), quiet: true });
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  transpilePackages: ['@estate-atlas/shared', '@estate-atlas/api-client'],
  poweredByHeader: false,
  // Isolated browser fixtures exercise the same /api topology as the public edge.
  async rewrites() {
    return process.env.EA_TEST_PROXY === '1'
      ? [{ source: '/api/:path*', destination: 'http://localhost:4001/:path*' }]
      : [];
  },
  async headers() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const apiOrigin = api.startsWith('/') ? '' : new URL(api).origin;
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${apiOrigin} https://tile.openstreetmap.org https://basemaps.cartocdn.com; connect-src 'self' ${apiOrigin}; font-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  experimental: { webpackMemoryOptimizations: true },
};
export default config;
