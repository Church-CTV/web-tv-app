/**
 * HomeScreen — unit tests.
 * Tests loadMainView by importing the module under mocked conditions.
 *
 * J2b-2: loadMainView now uses @ctv/core get() instead of raw fetch.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock core module — expose get/getServerBaseUrl/validateFeed/groupVideosByMonth
// Keep real mapHttpError/isUserFacingError/isRetryable
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    get: vi.fn(),
    getServerBaseUrl: vi.fn(),
    validateFeed: vi.fn(),
    getMonthKeys: vi.fn(),
    groupVideosByMonth: vi.fn(),
    mapHttpError: actual.mapHttpError,
    isUserFacingError: actual.isUserFacingError,
    isRetryable: actual.isRetryable,
    HttpError: actual.HttpError,
    ensureClientConfig: vi.fn(() =>
      Promise.resolve(actual.resolveClientConfig({ bundled: null, remote: null }))
    ),
    getEffectiveConfig: vi.fn(() => actual.DEFAULT_CLIENT_CONFIG),
  };
});

async function getCoreMocks() {
  const mod = await import('@ctv/core');
  return {
    get: vi.mocked(mod.get),
    getServerBaseUrl: vi.mocked(mod.getServerBaseUrl),
    validateFeed: vi.mocked(mod.validateFeed),
    getMonthKeys: vi.mocked(mod.getMonthKeys),
    groupVideosByMonth: vi.mocked(mod.groupVideosByMonth),
  };
}

// Mock ContentGrid
const gridExports = {
  createContentGrid: vi.fn(() => {
    const el = document.createElement('div');
    el.id = 'grid-rendered';
    return el;
  }),
  focusFirstCard: vi.fn(),
};
vi.mock('../../../src/ui/ContentGrid', () => gridExports);

// Mock LeftNav
const navExports = {
  createLeftNav: vi.fn(() => {
    const el = document.createElement('div');
    el.id = 'nav-rendered';
    return el;
  }),
};
vi.mock('../../../src/ui/LeftNav', () => navExports);

// Mock ErrorHandling (from project root shared/)
const errExports = {
  renderErrorScreen: vi.fn(() => '<div class="error-screen">Error</div>'),
  initErrorScreen: vi.fn(),
  getErrorScreen: vi.fn(() => ({ title: 'Error', message: 'Error' })),
};
vi.mock('../../../../shared/ErrorHandling', () => errExports);

// Mock visibility
const visExports = {
  showScreen: vi.fn(),
  hideScreen: vi.fn(),
};
vi.mock('../../../src/screens/visibility', () => visExports);

describe('HomeScreen loadMainView', () => {
  let loadMainView: typeof import('../../../src/screens/HomeScreen').loadMainView;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="content-grid" class="screen"></div>
      <div id="left-nav" class="screen"></div>
    `;
    vi.clearAllMocks();
    loadMainView = (await import('../../../src/screens/HomeScreen')).loadMainView;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders content grid on successful feed load', async () => {
    const { get, getServerBaseUrl, validateFeed, getMonthKeys, groupVideosByMonth } =
      await getCoreMocks();

    getServerBaseUrl.mockReturnValue('http://localhost:3000');
    validateFeed.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      videoCount: 1,
    });
    getMonthKeys.mockReturnValue(['2026-07']);
    groupVideosByMonth.mockReturnValue({ '2026-07': [{ id: 'v1', title: 'Video 1' }] as never });

    get.mockResolvedValueOnce({
      data: { '2026-07': [{ id: 'v1', title: 'Video 1', sdPosterUrl: '/img1.jpg' }] },
      status: 200,
    });

    const storage = { get: () => null, set: () => {} };
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
    };

    await loadMainView(storage, { trackInteraction: vi.fn() }, actions);

    const gridContainer = document.getElementById('content-grid');
    expect(gridContainer).toBeTruthy();
    expect(gridContainer?.innerHTML).not.toContain('Loading content...');
  });

  it('renders error screen on fetch failure', async () => {
    const { get, getServerBaseUrl } = await getCoreMocks();
    const { HttpError } = await import('@ctv/core');

    getServerBaseUrl.mockReturnValue('http://localhost:3000');
    get.mockRejectedValueOnce(new HttpError('http', 'HTTP 500', 500));

    const storage = { get: () => null, set: () => {} };
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
    };

    await loadMainView(storage, null, actions);

    const gridContainer = document.getElementById('content-grid');
    expect(gridContainer?.innerHTML).toContain('Error');
  });

  it('renders error screen on feed validation failure', async () => {
    const { get, getServerBaseUrl, validateFeed } = await getCoreMocks();

    getServerBaseUrl.mockReturnValue('http://localhost:3000');
    validateFeed.mockReturnValue({
      valid: false,
      errors: ['Missing fields'],
      warnings: [],
      videoCount: 0,
    });

    get.mockResolvedValueOnce({ data: {}, status: 200 });

    const storage = { get: () => null, set: () => {} };
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
    };

    await loadMainView(storage, null, actions);

    const gridContainer = document.getElementById('content-grid');
    expect(gridContainer?.innerHTML).toContain('Error');
  });

  it('handles missing grid container gracefully', async () => {
    document.body.innerHTML = '';

    const storage = { get: () => null, set: () => {} };
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
    };

    // Should not throw
    await loadMainView(storage, null, actions);
  });
});
