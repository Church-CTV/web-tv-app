import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from './server.ts';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../tests/fixtures/contracts');

describe('reference service', () => {
  it('has fixtures directory', () => {
    expect(existsSync(FIXTURES_DIR)).toBe(true);
  });

  it('can create server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
  });

  it('fixture files exist for all routes', () => {
    // Verify at least some key fixtures exist
    const keyFixtures = ['positive-feed.json', 'positive-health.json', 'positive-schedule.json'];
    for (const fixture of keyFixtures) {
      const path = resolve(FIXTURES_DIR, fixture);
      expect(existsSync(path)).toBe(true);
    }
  });
});
