import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../tests/fixtures/contracts');

function loadFixture(name: string) {
  const path = resolve(FIXTURES_DIR, name);
  expect(existsSync(path), `Fixture ${name} should exist`).toBe(true);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

describe('reference service fixtures and routes', () => {
  describe('fixture files exist and are valid JSON', () => {
    const fixtures = [
      'positive-feed.json',
      'positive-health.json',
      'positive-schedule.json',
      'positive-schedule-program.json',
      'positive-analytics-export.json',
      'positive-heartbeat-payload.json',
      'positive-heartbeat-response.json',
      'positive-crash-report.json',
      'positive-crash-clear.json',
    ];

    for (const fixture of fixtures) {
      it(`${fixture}`, () => {
        loadFixture(fixture);
      });
    }
  });

  describe('health fixture', () => {
    it('has required status', () => {
      const fixture = loadFixture('positive-health.json');
      expect(fixture.status).toBe('ok');
      expect(fixture).toHaveProperty('uptime');
      expect(fixture).toHaveProperty('timestamp');
    });
  });

  describe('feed fixture', () => {
    it('has required structure', () => {
      const fixture = loadFixture('positive-feed.json');
      expect(fixture).toHaveProperty('providerName');
      expect(fixture).toHaveProperty('lastUpdated');
      expect(fixture).toHaveProperty('language');
      expect(fixture).toHaveProperty('cardStyle');
      expect(fixture).toHaveProperty('config');
    });
  });

  describe('schedule fixture', () => {
    it('has required structure', () => {
      const fixture = loadFixture('positive-schedule.json');
      expect(fixture).toHaveProperty('channelSchedule');
      expect(fixture).toHaveProperty('channelNames');
      expect(fixture).toHaveProperty('channelOrder');
    });
  });

  describe('analytics export fixture', () => {
    it('has required structure', () => {
      const fixture = loadFixture('positive-analytics-export.json');
      expect(fixture).toHaveProperty('appVersion');
      expect(fixture).toHaveProperty('eventCount');
      expect(fixture).toHaveProperty('summary');
      expect(fixture).toHaveProperty('events');
    });
  });

  describe('heartbeat response fixture', () => {
    it('has required structure', () => {
      const fixture = loadFixture('positive-heartbeat-response.json');
      expect(fixture.ok).toBe(true);
      expect(fixture).toHaveProperty('serverTime');
    });
  });

  describe('crash clear fixture', () => {
    it('has required structure', () => {
      const fixture = loadFixture('positive-crash-clear.json');
      expect(fixture).toHaveProperty('cleared');
    });
  });

  describe('server module', () => {
    it('exports createServer function', async () => {
      const { createServer } = await import('./server.ts');
      expect(typeof createServer).toBe('function');
    });
  });
});
