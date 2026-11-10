import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    // A compiled `foo.js` sitting next to `foo.ts` wins Vite's extensionless resolution by
    // default, and the suite then tests the build output instead of the source: here, a
    // stale shared/ErrorHandling.js served an old error screen to the tests while the
    // source had already changed. Sources come first.
    extensions: ['.ts', '.mts', '.js', '.mjs', '.jsx', '.tsx', '.json'],
    alias: {
      '@ctv/core': path.resolve(__dirname, 'core/src'),
      '@ctv/shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // jsdom provides a real fetch, so an unstubbed request would reach a live
    // server. The suite is hermetic: this guard turns that mistake into a named
    // failure instead of a green run that a customer host answered.
    setupFiles: ['tests/unit-http-guard.ts'],
    // A test gets 20 s, not vitest's 5 s default. Measured on CI run 42474876738 (the
    // self-hosted runner, which also carries the rest of this account's work): a contract
    // test that finishes in 0 ms here and a startup-lifetime test that finishes in 4 ms
    // both hit the 5 s wall, while a 4 ms sibling reported 4 728 ms in the same second and
    // the run summary blamed jsdom creation (324 environments, 69 % of wall time). Waiting
    // longer changes nothing about what a test asserts; it only stops a saturated machine
    // from turning green work into red noise. A test that is *routinely* slow is still a
    // defect - fix the test, do not raise this number again.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    include: [
      'certification/**/*.test.ts',
      'core/**/*.test.ts',
      'shared/**/*.test.ts',
      'platforms/webos/**/*.test.ts',
      'platforms/tizen/**/*.test.ts',
      'platforms/vizio/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'scripts/**/*.test.mjs',
      'store-checklist/probes/**/*.test.mjs',
      'store-checklist/tools/**/*.test.mjs',
    ],
    exclude: ['**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'core/src/**/*.{ts,js}',
        'platforms/webos/src/**/*.{ts,js}',
        'platforms/tizen/src/**/*.{ts,js}',
        'platforms/vizio/src/**/*.{ts,js}',
        // shared/ tested by platform suites (alias mapping breaks v8 root-level coverage)
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/certification/**/*.test.ts',
        'scripts/**/*.test.mjs',
        'core/src/analytics/ExportPayload.ts',
        // Pure type files (interfaces/types erased at runtime — v8 can't measure them)
        'shared/contracts/**/*.ts',
        '**/*.d.ts',
        // Re-export-only index files have no executable logic, only exports
        '**/src/index.ts',
        '**/src/screens/index.ts',
      ],
      thresholds: {
        // Real thresholds - fails CI if coverage drops below these.
        // Root aggregate (measured 2026-08-28: ~90 / 86 / 82 / 90).
        // Re-baselined 2026-09-17 for vitest 5 v8 coverage engine (branch count methodology changed).
        // Set 1-2 points below actual to guard against variance.
        // Do NOT revert to autoUpdate: true - that auto-updates thresholds on every run.
        statements: 87,
        branches: 72,
        functions: 82,
        lines: 89,
      },
    },
  },
});
