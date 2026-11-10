/**
 * Playwright config — PRODUCTION bundle-size verification.
 *
 * Runs the E2E spec against the real `vite build` output via `vite preview`
 * (NOT the dev server). This is the authoritative production perf gate: it
 * measures the bytes of the actual shipped bundle and asserts it is under
 * the documented budget. The dev-server spec (playwright.config.ts) remains
 * for functional UI tests.
 *
 * Run with:
 *   npx playwright test --config playwright.production.config.ts
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/production',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // Perf specs measure wall-clock script execution, so they must not run against each
  // other. Two workers means the total-exec spec and the per-script spec each do five full
  // page loads while the sibling loads a browser context, and they score each other's CPU
  // contention instead of the bundle (evidence: run 40502514601 reported median 567 ms for
  // a chunk that measures 34 ms unloaded). One worker keeps the numbers about the bytes.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    actionTimeout: 5000,
    navigationTimeout: 10000,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-production',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'cd platforms/webos && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: process.env.CI ? false : true,
    timeout: 60000,
  },
});
