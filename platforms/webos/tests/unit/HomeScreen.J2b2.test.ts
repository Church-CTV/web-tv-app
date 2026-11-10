/**
 * HomeScreen — J2b-2: HttpClient wiring tests.
 *
 * Proves that loadMainView:
 * - Uses @ctv/core get() instead of raw fetch
 * - Maps HttpError to actionable error screens via mapHttpError
 * - Aborts in-flight requests on re-entry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @ctv/core: keep real mapHttpError/isUserFacingError/HttpError, mock get and getServerBaseUrl
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    ...actual,
    getServerBaseUrl: vi.fn(() => 'http://test-server'),
    get: vi.fn(),
    // Required exports that HomeScreen imports
    validateFeed: vi.fn((feed) => ({ valid: true, errors: [] })),
    getMonthKeys: vi.fn(() => ['2024-01']),
    groupVideosByMonth: vi.fn(() => ({
      '2024-01': [{ id: 'vid1', title: 'Test Video', thumbnail: '/thumb1.jpg', sdPosterUrl: '' }],
    })),
    ensureClientConfig: vi.fn(() =>
      Promise.resolve(actual.resolveClientConfig({ bundled: null, remote: null }))
    ),
    getEffectiveConfig: vi.fn(() => actual.DEFAULT_CLIENT_CONFIG),
  };
});

vi.mock('../../src/ui/ContentGrid', () => ({
  createContentGrid: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'content-grid';
    return el;
  }),
  focusFirstCard: vi.fn(),
}));

vi.mock('../../src/ui/LeftNav', () => ({
  createLeftNav: vi.fn(() => {
    const el = document.createElement('nav');
    el.className = 'left-nav';
    return el;
  }),
}));

describe('HomeScreen J2b-2: HttpClient wiring', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="content-grid" class="screen"></div>
      <div id="left-nav" class="screen"></div>
    `;
    consoleSpy = vi.spyOn(console, 'error');
    consoleSpy.mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const storage = { get: vi.fn(() => null), set: vi.fn() };
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
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: [],
    });

    await loadMainView(storage, null, actions);

    expect(get).toHaveBeenCalledWith(
      'http://test-server/feed',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('renders content grid on successful get()', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: [],
    });

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    // Should not show error screen
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
    expect(container?.querySelector('#btn-retry')).not.toBeNull();
  });

  it('shows error screen without retry for 401 auth error', async () => {
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('http', 'HTTP 401', 401));

    await loadMainView(storage, null, actions);

    const container = document.getElementById('content-grid');
    expect(container?.innerHTML).toContain('error-screen');
    expect(container?.querySelector('#btn-retry')).toBeNull();
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
        return Promise.resolve({ status: 200, data: [] });
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
