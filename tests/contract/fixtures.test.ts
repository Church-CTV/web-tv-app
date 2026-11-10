/**
 * WEB-022: Positive and negative contract fixtures for every API endpoint.
 * Uses fixture files in tests/fixtures/contracts/ for reusability across
 * platforms and E2E smoke tests.
 */
import { validateFeed } from '../../shared/contracts/feed';
import { validateAnalyticsEvent } from '../../shared/contracts/analytics';
import { SERVER_ENDPOINTS } from '../../shared/contracts/server';
import type { Feed } from '../../shared/contracts/feed';
import type { Schedule } from '../../shared/contracts/schedule';
import type { CrashReport, CrashClearResult } from '../../shared/contracts/crash';
import type { HeartbeatPayload, HeartbeatResponse } from '../../shared/contracts/heartbeat';
import type { AnalyticsExportPayload } from '../../shared/contracts/analytics';
import type { HealthResponse } from '../../shared/contracts/server';

import fs from 'fs';
import path from 'path';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'contracts');

function readFixture(name: string) {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

describe('WEB-022 contract fixtures', () => {
  describe('GET /feed', () => {
    test('positive: valid feed passes validation', () => {
      const feed = readFixture('positive-feed.json') as Feed;
      const result = validateFeed(feed);
      expect(result.valid).toBe(true);
      expect(result.videoCount).toBeGreaterThan(0);
    });

    test('negative: incomplete feed warns on optional branding fields', () => {
      const feed = readFixture('negative-feed-incomplete.json') as Feed;
      const result = validateFeed(feed);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Missing cardStyle');
      expect(result.warnings).toContain('Missing config');
    });
  });

  describe('POST /api/v1/analytics', () => {
    test('positive: valid analytics export payload', () => {
      const payload = readFixture('positive-analytics-export.json') as AnalyticsExportPayload;
      expect(payload.appVersion).toBe('1.0.0');
      expect(payload.eventCount).toBe(3);
      expect(payload.events?.screenViews).toHaveLength(1);
      expect(payload.events?.plays).toHaveLength(1);
      expect(payload.events?.deepLinks).toHaveLength(1);
    });

    test('negative: incomplete analytics payload', () => {
      const payload = readFixture('negative-analytics-incomplete.json');
      expect(payload.eventCount).toBe(0);
      expect(payload.events).toBeNull();
    });

    test('individual events validate', () => {
      const payload = readFixture('positive-analytics-export.json') as AnalyticsExportPayload;
      for (const evt of payload.events?.screenViews ?? []) {
        expect(validateAnalyticsEvent(evt).valid).toBe(true);
      }
      for (const evt of payload.events?.plays ?? []) {
        expect(validateAnalyticsEvent(evt).valid).toBe(true);
      }
      for (const evt of payload.events?.deepLinks ?? []) {
        expect(validateAnalyticsEvent(evt).valid).toBe(true);
      }
    });
  });

  describe('GET /health', () => {
    test('positive: valid health response', () => {
      const health = readFixture('positive-health.json') as HealthResponse;
      expect(health.status).toBe('ok');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/heartbeat', () => {
    test('positive: valid heartbeat payload', () => {
      const payload = readFixture('positive-heartbeat-payload.json') as HeartbeatPayload;
      expect(payload.deviceId).toBe('webos-test-001');
      expect(payload.os).toBe('webOS');
      expect(payload.appVersion).toBe('1.0.0');
    });

    test('positive: valid heartbeat response', () => {
      const response = readFixture('positive-heartbeat-response.json') as HeartbeatResponse;
      expect(response.ok).toBe(true);
      expect(response.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('GET /api/schedule', () => {
    test('positive: valid schedule with programs', () => {
      const schedule = readFixture('positive-schedule.json') as Schedule;
      expect(schedule.channelSchedule).toBeDefined();
      expect(schedule.channelSchedule?.['CH1']).toHaveLength(2);
      expect(schedule.channelNames?.['CH1']).toBe('Channel 1');
    });

    test('negative: empty schedule', () => {
      const schedule = readFixture('negative-schedule-empty.json') as Schedule;
      expect(schedule.channelSchedule).toEqual({});
    });
  });

  describe('GET /api/schedule/{id}', () => {
    test('positive: valid schedule program', () => {
      const program = readFixture('positive-schedule-program.json');
      expect(program.id).toBe('program-1');
      expect(program.start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(program.end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('GET /api/crash/report', () => {
    test('positive: crash report with errors', () => {
      const report = readFixture('positive-crash-report.json') as CrashReport;
      expect(report.total).toBe(1);
      expect(report.unreported).toBe(1);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].message).toContain('Cannot read property');
    });

    test('negative: empty crash report', () => {
      const report = readFixture('negative-crash-empty.json') as CrashReport;
      expect(report.total).toBe(0);
      expect(report.unreported).toBe(0);
      expect(report.errors).toHaveLength(0);
    });
  });

  describe('POST /api/crash/clear', () => {
    test('positive: crash clear result', () => {
      const result = readFixture('positive-crash-clear.json') as CrashClearResult;
      expect(result.cleared).toBe(1);
    });
  });

  describe('Endpoint contract alignment', () => {
    test('all documented endpoints have paths', () => {
      for (const [name, endpoint] of Object.entries(SERVER_ENDPOINTS)) {
        expect(endpoint.path).toBeDefined();
        expect(endpoint.path).toMatch(/^\//);
      }
    });

    test('endpoint paths match fixture test coverage', () => {
      expect(SERVER_ENDPOINTS.feed.path).toBe('/feed');
      expect(SERVER_ENDPOINTS.analyticsV1.path).toBe('/api/v1/analytics');
      expect(SERVER_ENDPOINTS.health.path).toBe('/health');
      expect(SERVER_ENDPOINTS.heartbeat.path).toBe('/api/heartbeat');
      expect(SERVER_ENDPOINTS.schedule.path).toBe('/api/schedule');
    });
  });
});
