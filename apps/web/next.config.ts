import type { NextConfig } from 'next';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../.env', import.meta.url), quiet: true });
const config: NextConfig = {
  transpilePackages: ['@estate-atlas/shared', '@estate-atlas/api-client'],
  poweredByHeader: false,
};
export default config;
