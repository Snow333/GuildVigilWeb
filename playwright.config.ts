import { defineConfig } from '@playwright/test';

/**
 * The 2.4 e2e suite runs against the BUILT single-file artifact via
 * `vite preview` (the artifact IS the product — plan Part IV-B).
 * One-time on a dev machine: `pnpm exec playwright install chromium` (~400 MB).
 * GV_CHROMIUM overrides the browser binary where a preinstalled Chromium must
 * be used instead (e.g. the cloud workspace pins an older revision).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4173',
    ...(process.env['GV_CHROMIUM'] ? { launchOptions: { executablePath: process.env['GV_CHROMIUM'] } } : {}),
  },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
});
