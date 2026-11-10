import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    // Compiled siblings must not shadow TypeScript sources (see the root vitest.config.ts).
    extensions: ['.ts', '.mts', '.js', '.mjs', '.jsx', '.tsx', '.json'],
    alias: {
      '@ctv/core': path.resolve(__dirname, '../../core/src'),
      '@ctv/shared': path.resolve(__dirname, '../../shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // jsdom ships a real fetch and the adapters' default server is a live customer
    // host: block unstubbed requests instead of letting a green run mean the
    // production channel answered (see tests/unit-http-guard.ts).
    setupFiles: [path.resolve(__dirname, '../../tests/unit-http-guard.ts')],
    testTimeout: 10000,
    teardownTimeout: 5000,
    pool: 'forks',
    forceExit: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Only measure source; packaging artifacts under build/ and compiled
      // output under dist/ are generated, not source, and must not dilute
      // the coverage denominator.
      exclude: ['**/build/**', '**/dist/**', '**/node_modules/**', 'tests/**'],
      thresholds: {
        // Real thresholds - fails CI if coverage drops below these.
        // Set 1-2 points below actual to guard against variance.
        // Measured 2026-08-28: ~85 / 85 / 67 / 85
        statements: 87,
        branches: 75,
        functions: 86,
        lines: 89,
      },
    },
  },
});
