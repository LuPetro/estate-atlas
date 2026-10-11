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
  experimental: { webpackMemoryOptimizations: true },
};
export default config;
