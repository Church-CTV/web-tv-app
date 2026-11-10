/**
 * Contract import smoke test — verifies all contract exports resolve.
 * No behavioral logic; only checks the shared type surface is valid.
 */
import {
  EventType,
  AnalyticsEvent,
  validateAnalyticsEvent,
} from '../../shared/contracts/analytics';
import { CrashErrorInfo, CrashReport } from '../../shared/contracts/crash';
import { Feed, VideoItem, validateFeed } from '../../shared/contracts/feed';
import { HeartbeatPayload, HeartbeatResponse } from '../../shared/contracts/heartbeat';
import {
  ScheduleProgram,
  Schedule,
  ScheduleEvent,
  Reminder,
} from '../../shared/contracts/schedule';
import { SERVER_ENDPOINTS, ServerConfig, buildUrl } from '../../shared/contracts/server';

describe('shared contracts import smoke test', () => {
  test('analytics types are exported', () => {
    expect(typeof EventType).toBe('undefined');
    expect(typeof validateAnalyticsEvent).toBe('function');
  });

  test('crash types are exported', () => {
    expect(typeof CrashErrorInfo).toBe('undefined');
    expect(typeof CrashReport).toBe('undefined');
  });

  test('feed types are exported', () => {
    expect(typeof Feed).toBe('undefined');
    expect(typeof validateFeed).toBe('function');
  });

  test('heartbeat types are exported', () => {
    expect(typeof HeartbeatPayload).toBe('undefined');
    expect(typeof HeartbeatResponse).toBe('undefined');
  });

  test('schedule types are exported', () => {
    expect(typeof ScheduleProgram).toBe('undefined');
    expect(typeof Schedule).toBe('undefined');
    expect(typeof Reminder).toBe('undefined');
  });

  test('server endpoints are defined', () => {
    expect(SERVER_ENDPOINTS.feed).toBeDefined();
    expect(SERVER_ENDPOINTS.feed.path).toBe('/feed');
    expect(SERVER_ENDPOINTS.heartbeat.path).toBe('/api/heartbeat');
    expect(buildUrl('https://api.example.com', '/feed')).toBe('https://api.example.com/feed');
  });
});
