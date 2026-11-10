/**
 * App-level channel profile wiring (webOS).
 *
 * The screen-level contract (tests/contract/client-config-takes-effect.test.ts)
 * proves the grid follows the profile. This proves what only App.ts can get
 * wrong: the switches that stop work before a screen ever renders - the clock
 * timer, and telemetry - and that the tunables in the delivered profile are the
 * values the analytics engine is actually built with.
 */

// The real profile the production server delivers for this channel, with the
// two switches flipped off for the case under test.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PROFILE = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'shared',
      'test-fixtures',
      'synthetic',
      'one.config.json'
    ),
    'utf-8'
  )
) as Record<string, unknown>;

const analyticsMock = vi.hoisted(() => ({
  setOptOut: vi.fn(),
  shutdown: vi.fn(),
  trackInteraction: vi.fn(),
  getDeviceInfo: vi.fn(() => ({ deviceId: 'device-from-engine', appVersion: '0.1.0' })),
  created: [] as unknown[],
  exportFns: [] as ((events: unknown[]) => Promise<void>)[],
}));

// The transport is where the endpoint lands, so it is spied rather than mocked
// away: an App that resolved the profile but kept posting to a hardcoded path
// is exactly the defect WEB-054 is about.
const transportMock = vi.hoisted(() => ({
  endpoints: [] as unknown[],
  sends: [] as [unknown[], unknown][],
}));

vi.mock('../../src/Adapter/Analytics', () => ({
  createAnalyticsExport: vi.fn((endpoint: unknown) => {
    transportMock.endpoints.push(endpoint);
    return async (events: unknown[], deviceInfo: unknown): Promise<void> => {
      transportMock.sends.push([events, deviceInfo]);
    };
  }),
}));

vi.mock('../../src/screenLoader', () => ({
  loadMainView: vi.fn(async () => {}),
  loadSettingsScreen: vi.fn(),
  loadSearchScreen: vi.fn(),
}));
vi.mock('../../src/modules/initAnalytics', () => ({
  createAnalytics: vi.fn((options: unknown, exportFn: (events: unknown[]) => Promise<void>) => {
    analyticsMock.created.push(options);
    analyticsMock.exportFns.push(exportFn);
    return analyticsMock;
  }),
}));
vi.mock('../../src/modules/initCrashReporting', () => ({ createCrashReporter: vi.fn() }));
vi.mock('../../src/Adapter/CrashReporter', () => ({ flushCrashReports: vi.fn() }));
vi.mock('../../src/modules/initVideoPlayer', () => ({ createVideoPlayer: vi.fn(() => ({})) }));
vi.mock('../../src/modules/initRemoteControl', () => ({
  createRemoteControl: vi.fn(() => ({ onKeyPress: vi.fn(), destroy: vi.fn() })),
}));
vi.mock('../../src/ui/SplashScreen', () => ({
  initSplashScreen: vi.fn(() => ({ dismiss: vi.fn() })),
}));

const { initApp } = await import('../../src/App');

// App.ts boots itself on import. Draining that run here is what makes each case
// below call initApp() on its own terms instead of joining a startup that was
// already in flight.
await vi.waitFor(() => expect(analyticsMock.created.length).toBeGreaterThan(0));

function serveProfile(profile: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => structuredClone(profile),
      text: async () => JSON.stringify(profile),
    }))
  );
}

describe('webOS app applies the delivered channel profile at startup', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ctv_server_config', JSON.stringify({ baseUrl: 'https://channel.example.test', timeout: 15 }));
    analyticsMock.created.length = 0;
    analyticsMock.exportFns.length = 0;
    analyticsMock.setOptOut.mockClear();
    transportMock.endpoints.length = 0;
    transportMock.sends.length = 0;
    document.body.innerHTML =
      '<header id="overhang"><h1 class="overhang__title">Chroma Channel</h1>' +
      '<span id="overhang-clock"></span></header>' +
      '<div id="screen-grid"><div id="content-grid"></div></div>';
    vi.stubEnv('PROD', true);
  });

  it('builds analytics from the delivered tunables, not from code constants', async () => {
    serveProfile(PROFILE);
    await initApp();
    expect(analyticsMock.created).toHaveLength(1);
    const options = analyticsMock.created[0] as Record<string, number | boolean | string>;
    const delivered = PROFILE.config as {
      analytics: { exportIntervalSeconds: number; maxEventsPerBatch: number };
      content: { retryAttempts: number; retryDelayMs: number; fetchTimeout: number };
    };
    expect(options.exportIntervalSeconds).toBe(delivered.analytics.exportIntervalSeconds);
    expect(options.maxEventsPerBatch).toBe(delivered.analytics.maxEventsPerBatch);
    expect(options.retryAttempts).toBe(delivered.content.retryAttempts);
    expect(options.retryBaseDelayMs).toBe(delivered.content.retryDelayMs);
    expect(options.exportTimeoutSeconds).toBe(delivered.content.fetchTimeout);
  });

  it('a profile kill switch on telemetry wins over the viewer having consented', async () => {
    const off = structuredClone(PROFILE) as Record<string, unknown>;
    (off.config as Record<string, { analytics: Record<string, unknown> }>).analytics.enabled =
      false;
    serveProfile(off);
    // The viewer opted in: consent alone would let telemetry run.
    localStorage.setItem('ctv_pref_share_usage', 'true');
    await initApp();
    expect(analyticsMock.setOptOut).toHaveBeenLastCalledWith(true);
  });

  it('telemetry stays on when both the profile and the viewer allow it', async () => {
    serveProfile(PROFILE);
    localStorage.setItem('ctv_pref_share_usage', 'true');
    await initApp();
    expect(analyticsMock.setOptOut).toHaveBeenLastCalledWith(false);
  });

  it('telemetry goes where the profile says, in the envelope that endpoint takes', async () => {
    // The tunables case above shows the engine is built from the profile. This
    // one shows the transport is aimed at the profile too: the resolved url, the
    // v2 body mode, and the device id the envelope requires.
    serveProfile(PROFILE);
    localStorage.setItem('ctv_pref_share_usage', 'true');
    await initApp();

    expect(transportMock.endpoints).toEqual([
      { url: 'https://channel.example.test/api/v2/analytics', envelope: 'v2' },
    ]);
    const exportFn = analyticsMock.exportFns[0];
    expect(typeof exportFn).toBe('function');

    await exportFn([
      { eventType: 'screen_view', timestamp: '2026-11-09T20:00:00.000Z', screenName: 'home' },
    ]);
    expect(transportMock.sends).toHaveLength(1);
    const [sentEvents, sentDeviceInfo] = transportMock.sends[0] as [
      unknown[],
      { deviceId?: string } | undefined,
    ];
    expect(sentEvents).toHaveLength(1);
    expect(sentDeviceInfo?.deviceId).toBe('device-from-engine');
  });

  it('a profile export url on another origin never moves telemetry off the configured host', async () => {
    const hijacked = structuredClone(PROFILE) as Record<string, unknown>;
    (
      hijacked.config as Record<string, { analytics: Record<string, unknown> }>
    ).analytics.exportUrl = 'https://collector.example.net/api/v2/analytics';
    serveProfile(hijacked);
    localStorage.setItem('ctv_pref_share_usage', 'true');
    await initApp();

    expect(transportMock.endpoints).toEqual([
      { url: 'https://channel.example.test/api/analytics', envelope: 'legacy' },
    ]);
  });

  it('a clock switch off draws no clock and starts no timer', async () => {
    vi.useFakeTimers();
    try {
      const off = structuredClone(PROFILE) as Record<string, unknown>;
      (off.config as Record<string, { features: Record<string, unknown> }>).features.overhangClock =
        false;
      // This case counts live timers, so the bounded config poll has to be off
      // in the profile too; otherwise the one honest timer in the room is the
      // poll and the assertion measures the wrong thing.
      (off.config as Record<string, Record<string, unknown>>).client = {
        refreshIntervalSeconds: 0,
      };
      serveProfile(off);
      await initApp();
      await vi.runAllTimersAsync();
      expect(document.getElementById('overhang-clock')?.textContent).toBe('');
      // No interval may survive: the switch has to stop the work.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
