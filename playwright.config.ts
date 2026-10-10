import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: { baseURL: 'http://localhost:3001', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'mobile-web', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node --import tsx scripts/e2e-api.ts',
      url: 'http://localhost:4001/health',
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
      timeout: 60000,
    },
    {
      command: 'pnpm --filter @estate-atlas/web start --port 3001',
      env: { NEXT_DIST_DIR: '.next-e2e', NEXT_PUBLIC_API_URL: 'http://localhost:4001' },
      url: 'http://localhost:3001',
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
      timeout: 60000,
    },
  ],
});
