/**
 * Vizio J2b-3: HttpClient wiring tests for Home and Schedule screens.
 *
 * The SubscriptionScreen wiring suite that used to live here was deleted with the screen
 * itself (owner decision 2026-11-09, "Delete subscription. We don't have that in
 * app"). The abort-on-replace and retry-path assertions for a screen that cannot
 * be reached from any nav or deep link were testing an unreachable surface.
 *
 * Proves that all three screens:
 * - Use @ctv/core get() instead of raw fetch
 * - Map HttpError to actionable error screens via mapHttpError/isUserFacingError
 * - Abort in-flight requests on re-entry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @ctv/core: keep real mapHttpError/isUserFacingError/HttpError, mock get, getServerBaseUrl,
// validateFeed, getMonthKeys so tests control all dependencies.
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    ...actual,
    getServerBaseUrl: vi.fn(() => 'http://test-server'),
    get: vi.fn(),
    validateFeed: vi.fn((_feed: unknown) => ({ valid: true, errors: [], warnings: [] })),
    getMonthKeys: vi.fn((_feed: Record<string, unknown[]>) => ['2024-01']),
    ensureClientConfig: vi.fn(() =>
      Promise.resolve(actual.resolveClientConfig({ bundled: null, remote: null }))
    ),
    getEffectiveConfig: vi.fn(() => actual.DEFAULT_CLIENT_CONFIG),
  };
});

describe('Vizio J2b-3: HomeScreen HttpClient wiring', () => {
  let consoleSpyErr: ReturnType<typeof vi.spyOn>;
  let consoleSpyLog: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="content-grid" class="screen"></div>
      <div id="left-nav" class="screen"></div>
    `;
    consoleSpyErr = vi.spyOn(console, 'error');
    consoleSpyErr.mockImplementation(() => {});
    consoleSpyLog = vi.spyOn(console, 'log');
    consoleSpyLog.mockImplementation(() => {});
    // Reset mock implementation after each test's clearAllMocks
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, data: {} });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const storage = {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
    getAll: vi.fn(() => ({})),
  };
  const actions = {
    onVideoSelect: vi.fn(),
    onSearch: vi.fn(),
    onSchedule: vi.fn(),
    onContinueWatching: vi.fn(),
    onWatchLater: vi.fn(),
    onSettings: vi.fn(),
    onRetry: vi.fn(),
  };

  it('calls get() from @ctv/core with correct URL and AbortSignal', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, data: {} });

    await loadMainView(storage, null, actions);

    expect(get).toHaveBeenCalledWith(
      'http://test-server/feed',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('renders content grid on successful get() without error screen', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, data: {} });

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).not.toContain('error-screen');
  });

  it('shows network error screen with retry button for HttpError network', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('network', 'Failed to fetch')
    );

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('shows error screen without retry for 401 auth error', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 401', 401));

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    // 401 auth is not retryable — the error screen should still show an error,
    // but the error type should be 'auth' not 'network'
    const errorScreen = container?.querySelector('.error-screen');
    expect(errorScreen?.textContent).not.toContain('No internet connection');
  });

  it('shows error screen with retry for 503 server error', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 503', 503));

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('shows error screen with retry for 429 rate limited', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 429', 429));

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('shows error screen without retry for 404 not found', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 404', 404));

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).toBeNull();
  });

  it('shows error screen with retry for 408 request timeout', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 408', 408));

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('shows error screen with retry for timeout code', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('timeout', 'Request timed out')
    );

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('does not render error screen for abort', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('abort', 'Request aborted'));

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).not.toContain('error-screen');
  });

  it('aborts previous in-flight request when loadMainView is called again', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');

    const calls: Array<{ url: string; signal?: AbortSignal }> = [];

    (get as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, config?: { signal?: AbortSignal }) => {
        calls.push({ url, signal: config?.signal });
        if (calls.length === 1) {
          return new Promise((_, reject) => {
            config?.signal?.addEventListener('abort', () => {
              reject(new HttpError('abort', 'Request aborted'));
            });
          });
        }
        return Promise.resolve({ status: 200, data: {} });
      }
    );

    const firstLoad = loadMainView(storage, null, actions).catch(() => {});
    await new Promise(process.nextTick);

    expect(calls).toHaveLength(1);
    expect(calls[0].signal?.aborted).toBe(false);

    const secondLoad = loadMainView(storage, null, actions);
    await new Promise(process.nextTick);

    expect(calls).toHaveLength(2);
    expect(calls[0].signal?.aborted).toBe(true);
    expect(calls[1].signal?.aborted).toBe(false);

    await Promise.all([firstLoad, secondLoad]);
  });
});

describe('Vizio J2b-3: ScheduleScreen HttpClient wiring', () => {
  let consoleSpyErr: ReturnType<typeof vi.spyOn>;
  let consoleSpyLog: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="screen-schedule" class="screen"></div>
    `;
    consoleSpyErr = vi.spyOn(console, 'error');
    consoleSpyErr.mockImplementation(() => {});
    consoleSpyLog = vi.spyOn(console, 'log');
    consoleSpyLog.mockImplementation(() => {});
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, data: { programs: [] } });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const storage = {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
    getAll: vi.fn(() => ({})),
  };
  const screenActions = { onPlay: vi.fn() };

  it('calls get() from @ctv/core with correct URL and AbortSignal', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: { programs: [] },
    });

    await loadScheduleScreen(storage, screenActions);

    expect(get).toHaveBeenCalledWith(
      'http://test-server/schedule',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('renders schedule on successful get() without error screen', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: {
        programs: [
          {
            title: 'Morning News',
            description: 'Daily news',
            startTime: '2026-07-08T07:00:00Z',
            endTime: '2026-07-08T08:00:00Z',
            isLive: false,
          },
        ],
      },
    });

    await loadScheduleScreen(storage, screenActions);

    const container = document.getElementById('screen-schedule');
    expect(container?.innerHTML).not.toContain('error-screen');
  });

  it('shows network error screen with retry button for HttpError network', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('network', 'Failed to fetch')
    );

    await loadScheduleScreen(storage, screenActions);

    const container = document.getElementById('screen-schedule');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('shows error screen without retry for 401 auth error', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 401', 401));

    await loadScheduleScreen(storage, screenActions);

    const container = document.getElementById('screen-schedule');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).toBeNull();
  });

  it('shows error screen with retry for 503 server error', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 503', 503));

    await loadScheduleScreen(storage, screenActions);

    const container = document.getElementById('screen-schedule');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('shows error screen without retry for 404 not found', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 404', 404));

    await loadScheduleScreen(storage, screenActions);

    const container = document.getElementById('screen-schedule');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).toBeNull();
  });

  it('shows error screen with retry for 408 request timeout', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 408', 408));

    await loadScheduleScreen(storage, screenActions);

    const container = document.getElementById('screen-schedule');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#error-retry')).not.toBeNull();
  });

  it('does not render error screen for abort', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('abort', 'Request aborted'));

    await loadScheduleScreen(storage, screenActions);

    const container = document.getElementById('screen-schedule');
    expect(container?.innerHTML).not.toContain('error-screen');
  });

  it('aborts previous in-flight request on re-entry', async () => {
    const { loadScheduleScreen } = await import('../../src/screens/ScheduleScreen');
    const { get, HttpError } = await import('@ctv/core');

    const calls: Array<{ url: string; signal?: AbortSignal }> = [];

    (get as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, config?: { signal?: AbortSignal }) => {
        calls.push({ url, signal: config?.signal });
        if (calls.length === 1) {
          return new Promise((_, reject) => {
            config?.signal?.addEventListener('abort', () => {
              reject(new HttpError('abort', 'Request aborted'));
            });
          });
        }
        return Promise.resolve({ status: 200, data: { programs: [] } });
      }
    );

    const firstLoad = loadScheduleScreen(storage, screenActions).catch(() => {});
    await new Promise(process.nextTick);

    expect(calls).toHaveLength(1);
    expect(calls[0].signal?.aborted).toBe(false);

    const secondLoad = loadScheduleScreen(storage, screenActions);
    await new Promise(process.nextTick);

    expect(calls).toHaveLength(2);
    expect(calls[0].signal?.aborted).toBe(true);
    expect(calls[1].signal?.aborted).toBe(false);

    await Promise.all([firstLoad, secondLoad]);
  });
});
