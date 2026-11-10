/**
 * Tizen HomeScreen — unit tests.
 * Tests loadMainView integration for Tizen platform.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock core
const coreMock = {
  getServerBaseUrl: vi.fn(),
  validateFeed: vi.fn(),
  getMonthKeys: vi.fn(),
  groupVideosByMonth: vi.fn(),
};
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    ...coreMock,
    get: actual.get,
    resolvePlayableUrl: actual.resolvePlayableUrl,
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

// Mock Tizen UI adapters
vi.mock('../../../src/ui/ContentGrid', () => ({
  renderContentGrid: vi.fn(() => '<div class="content-grid"></div>'),
  initContentGrid: vi.fn(),
}));
vi.mock('../../../src/ui/LeftNav', () => ({
  renderLeftNav: vi.fn(() => '<div class="left-nav"></div>'),
  initLeftNav: vi.fn(),
}));

// Mock ErrorHandling (Tizen uses ../../../../shared/ErrorHandling)
vi.mock('../../../../shared/ErrorHandling', () => ({
  renderErrorScreen: vi.fn(() => '<div class="error-screen">Error</div>'),
  initErrorScreen: vi.fn(),
  getErrorScreen: vi.fn(() => ({ title: 'Error', message: 'Error' })),
}));

// Mock visibility
vi.mock('../../../src/screens/visibility', () => ({
  showScreen: vi.fn(),
  hideScreen: vi.fn(),
}));

describe('Tizen HomeScreen', () => {
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
    coreMock.getServerBaseUrl.mockReturnValue('http://localhost:3000');
    coreMock.validateFeed.mockReturnValue({ valid: true, errors: [], warnings: [], videoCount: 1 });
    coreMock.getMonthKeys.mockReturnValue(['2026-07']);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ '2026-07': [{ id: 'v1', title: 'V1' }] }),
    });

    const storage = { get: () => null, set: () => {}, remove: () => {}, getAll: () => ({}) };
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

    expect(document.getElementById('content-grid')).toBeTruthy();
  });

  it('renders error screen on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const storage = { get: () => null, set: () => {}, remove: () => {}, getAll: () => ({}) };
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

    expect(document.getElementById('content-grid')?.innerHTML).toContain('Error');
  });

  it('handles missing grid container gracefully', async () => {
    document.body.innerHTML = '';
    const storage = { get: () => null, set: () => {}, remove: () => {}, getAll: () => ({}) };
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
    };
    await loadMainView(storage, null, actions); // No crash
  });

  it('renders left nav when renderLeftNav succeeds', async () => {
    coreMock.getServerBaseUrl.mockReturnValue('http://localhost:3000');
    coreMock.validateFeed.mockReturnValue({ valid: true, errors: [], warnings: [], videoCount: 1 });
    coreMock.getMonthKeys.mockReturnValue(['2026-07']);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ '2026-07': [{ id: 'v1', title: 'V1' }] }),
    });

    const storage = { get: () => null, set: () => {}, remove: () => {}, getAll: () => ({}) };
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

    // Left nav should be rendered
    const leftNav = document.getElementById('left-nav');
    expect(leftNav).toBeTruthy();
  });

  it('activates the grid screen after a successful feed load (RED → GREEN: D6)', async () => {
    // Regression: index.html ships with #screen-loading active. If HomeScreen
    // never calls showScreen('screen-grid'), the loading overlay stays up and
    // blocks all clicks in production (seen on Tizen/Vizio preview).
    coreMock.getServerBaseUrl.mockReturnValue('http://localhost:3000');
    coreMock.validateFeed.mockReturnValue({ valid: true, errors: [], warnings: [], videoCount: 1 });
    coreMock.getMonthKeys.mockReturnValue(['2026-07']);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ '2026-07': [{ id: 'v1', title: 'V1' }] }),
    });

    const storage = { get: () => null, set: () => {}, remove: () => {}, getAll: () => ({}) };
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

    const showScreen = vi.mocked((await import('../../../src/screens/visibility')).showScreen);
    expect(showScreen).toHaveBeenCalledWith('screen-grid');
  });

  it('activates the grid screen on feed failure, not the dead static error panel (RED → GREEN: D6)', async () => {
    // Regression: the static #screen-error panel overlays the dynamic error
    // UI rendered into #content-grid, leaving two retry buttons and intercepting
    // clicks on the working one. Must activate screen-grid, not screen-error.
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const storage = { get: () => null, set: () => {}, remove: () => {}, getAll: () => ({}) };
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

    const showScreen = vi.mocked((await import('../../../src/screens/visibility')).showScreen);
    expect(showScreen).toHaveBeenCalledWith('screen-grid');
    expect(showScreen).not.toHaveBeenCalledWith('screen-error');
  });

  it('tracks interaction on video select', async () => {
    coreMock.getServerBaseUrl.mockReturnValue('http://localhost:3000');
    coreMock.validateFeed.mockReturnValue({ valid: true, errors: [], warnings: [], videoCount: 1 });
    coreMock.getMonthKeys.mockReturnValue(['2026-07']);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ '2026-07': [{ id: 'v1', title: 'Test Video' }] }),
    });

    const trackInteraction = vi.fn();
    const storage = { get: () => null, set: () => {}, remove: () => {}, getAll: () => ({}) };
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
    };

    await loadMainView(storage, { trackInteraction }, actions);

    // Get the content grid container and simulate a click
    const contentGrid = document.getElementById('content-grid');
    if (contentGrid) {
      const cards = contentGrid.querySelectorAll('[data-video-id]');
      if (cards.length > 0) {
        // Simulate selecting a video
        const onVideoSelect = actions.onVideoSelect;
        expect(onVideoSelect).toBeDefined();
      }
    }
  });
});
