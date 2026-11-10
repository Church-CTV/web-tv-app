import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@ctv/shared': path.resolve(__dirname, '../shared'),
    },
  },
  test: {
    // jsdom ships a real fetch and the adapters' default server is a live customer
    // host: block unstubbed requests instead of letting a green run mean the
    // production channel answered (see tests/unit-http-guard.ts).
    setupFiles: [path.resolve(__dirname, '../tests/unit-http-guard.ts')],
    // Exclude integration smoke tests from default suite
    // They require a running server, not suitable for fast unit test runs
    exclude: ['**/smoke.test.ts'],
  },
});
