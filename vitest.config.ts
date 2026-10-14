import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts', 'scripts/**/*.test.mjs'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
