import { defineConfig } from '@playwright/test';

/**
 * The 2.4 e2e suite runs against the BUILT single-file artifact via
 * `vite preview` (the artifact IS the product — plan Part IV-B).
 * One-time on a dev machine: `pnpm exec playwright install chromium` (~400 MB).
 * GV_CHROMIUM overrides the browser binary where a preinstalled Chromium must
 * be used instead (e.g. the cloud workspace pins an older revision).
 */
// GV_PORT lets parallel worktrees run e2e at once without one reusing the
// other's preview server (reuseExistingServer would silently test the wrong build).
const PORT = Number(process.env['GV_PORT'] ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...(process.env['GV_CHROMIUM'] ? { launchOptions: { executablePath: process.env['GV_CHROMIUM'] } } : {}),
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
  },
});
