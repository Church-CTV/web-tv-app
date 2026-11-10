/**
 * Tizen screen loaders — interaction tests (second pass).
 * Covers onFeedLoaded, error paths, and DOM structure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// Mock @ctv/core — mock get so tests control responses directly; keep real
// mapHttpError/isUserFacingError/isRetryable/HttpError for error classification
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    ...actual,
    get: vi.fn(),
    getServerBaseUrl: vi.fn(() => 'http://localhost:3000'),
    validateFeed: vi.fn((feed: unknown) => ({
      valid: true,
      errors: [],
      warnings: [],
      videoCount: 0,
      feed,
    })),
  };
});

vi.mock('@ctv/shared/ErrorHandling', () => ({
  renderErrorScreen: vi.fn(() => '<div class="error-screen">Error</div>'),
  initErrorScreen: vi.fn(),
  getErrorScreen: vi.fn(() => ({ title: 'Error', message: 'Error', type: 'feed' })),
}));

vi.mock('../../../src/screens/visibility', () => ({
  showScreen: vi.fn(),
  hideScreen: vi.fn(),
}));

function mockStorage(items: Record<string, string> = {}) {
  const store = { ...items };
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, value: string) => {
      store[key] = value;
    },
    remove: (key: string) => {
      delete store[key];
    },
    getAll: () => ({ ...store }),
  };
}

function resetDOM(html = '') {
  document.body.innerHTML = html;
}

// ─── HomeScreen interaction ───────────────────────────────────────────────────

describe('Tizen HomeScreen loader interaction', () => {
  let loadMainView: typeof import('../../../src/screens/HomeScreen').loadMainView;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM(`
      <div id="content-grid" class="screen"></div>
      <div id="left-nav" class="screen"></div>
      <div id="screen-error" class="screen"></div>
    `);
    loadMainView = (await import('../../../src/screens/HomeScreen')).loadMainView;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  async function loadHome(analytics: { trackInteraction: (a: string, t?: string) => void } | null) {
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
      onFeedLoaded: vi.fn(),
    };
    await loadMainView(mockStorage(), analytics, actions);
    return actions;
  }

  it('calls onFeedLoaded with all videos after a successful load', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: {
        'August 2026': [
          { id: 'v1', title: 'Video One' },
          { id: 'v2', title: 'Video Two', sdPosterUrl: '/v2.jpg' },
        ],
      },
    });

    const actions = await loadHome({ trackInteraction: vi.fn() });

    expect(actions.onFeedLoaded).toHaveBeenCalledTimes(1);
    const videos = vi.mocked(actions.onFeedLoaded).mock.calls[0][0];
    expect(videos).toHaveLength(2);
    expect(videos[0].videoId).toBe('v1');
    expect(videos[0].title).toBe('Video One');
    expect(videos[1].videoId).toBe('v2');
    expect(videos[1].title).toBe('Video Two');
    expect(videos[1].thumbnail).toBe('/v2.jpg');
  });

  it('falls back to sdPosterUrl when thumbnail is missing', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: { 'August 2026': [{ id: 'v1', title: 'V1', sdPosterUrl: '/v1s.jpg' }] },
    });

    const actions = await loadHome(null);
    const videos = vi.mocked(actions.onFeedLoaded).mock.calls[0][0];
    expect(videos[0].thumbnail).toBe('/v1s.jpg');
  });

  it('renders the grid with videos from the feed', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: { 'August 2026': [{ id: 'v1', title: 'Video One' }] },
    });

    await loadHome(null);

    const grid = document.getElementById('content-grid');
    expect(grid?.innerHTML).toContain('Video One');
    expect(grid?.innerHTML).toContain('data-video-id="v1"');
  });

  it('renders the left nav with all navigation items', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: { 'August 2026': [{ id: 'v1', title: 'V1' }] },
    });

    await loadHome(null);

    const nav = document.getElementById('left-nav');
    expect(nav).toBeTruthy();
    // Should contain nav items with data-nav-id attributes
    expect(nav?.innerHTML).toContain('left-nav__item');
    expect(nav?.innerHTML).toContain('data-nav-id="home"');
    expect(nav?.innerHTML).toContain('data-nav-id="search"');
    expect(nav?.innerHTML).toContain('data-nav-id="settings"');
    expect(nav?.innerHTML).not.toContain('data-nav-id="schedule"');
    expect(nav?.innerHTML).not.toContain('data-nav-id="continue"');
    expect(nav?.innerHTML).not.toContain('data-nav-id="watch-later"');
    expect(nav?.innerHTML).not.toContain('data-nav-id="subscribe"');
  });

  it('renders error screen when feed validation fails', async () => {
    const coreModule = await import('@ctv/core');
    vi.mocked(coreModule.validateFeed).mockReturnValueOnce({
      valid: false,
      errors: ['Missing fields'],
      warnings: [],
      videoCount: 0,
    } as never);

    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, data: {} });

    const actions = await loadHome(null);

    const grid = document.getElementById('content-grid');
    expect(grid?.innerHTML).toContain('error-screen');
    expect(actions.onFeedLoaded).not.toHaveBeenCalled();
  });

  it('renders error screen when fetch fails', async () => {
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('http', 'HTTP 503: Service Unavailable', 503)
    );
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const actions = await loadHome(null);

    const grid = document.getElementById('content-grid');
    expect(grid?.innerHTML).toContain('error-screen');
    expect(actions.onFeedLoaded).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
  });

  it('renders error screen on network exception', async () => {
    const { get, HttpError } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockRejectedValue(new HttpError('network', 'Network error'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const actions = await loadHome(null);

    const grid = document.getElementById('content-grid');
    expect(grid?.innerHTML).toContain('error-screen');
    expect(actions.onFeedLoaded).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
  });

  it('handles empty feed gracefully', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, data: {} });

    const actions = await loadHome(null);

    expect(actions.onFeedLoaded).toHaveBeenCalledTimes(1);
    const videos = vi.mocked(actions.onFeedLoaded).mock.calls[0][0];
    expect(videos).toHaveLength(0);
  });

  it('triggers onVideoSelect when a video card is clicked', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: { 'August 2026': [{ id: 'v1', title: 'Video One' }] },
    });

    const actions = await loadHome(null);

    const card = document.querySelector('[data-video-id="v1"]') as HTMLElement | null;
    expect(card).not.toBeNull();
    card?.click();

    expect(actions.onVideoSelect).toHaveBeenCalledWith('v1', 'Video One');
  });

  it('triggers the matching nav action when a left-nav item is clicked', async () => {
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: { 'August 2026': [{ id: 'v1', title: 'V1' }] },
    });

    const actions = await loadHome({ trackInteraction: vi.fn() });

    const searchBtn = document.querySelector('[data-nav-id="search"]') as HTMLElement | null;
    expect(searchBtn).not.toBeNull();
    searchBtn?.click();
    expect(actions.onSearch).toHaveBeenCalledTimes(1);

    const settingsBtn = document.querySelector('[data-nav-id="settings"]') as HTMLElement | null;
    settingsBtn?.click();
    expect(actions.onSettings).toHaveBeenCalledTimes(1);
  });
});

// ─── SearchScreen interaction ─────────────────────────────────────────────────

describe('Tizen SearchScreen loader interaction', () => {
  let loadSearchScreen: typeof import('../../../src/screens/SearchScreen').loadSearchScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM('<div id="screen-search" class="screen"></div>');
    loadSearchScreen = (await import('../../../src/screens/SearchScreen')).loadSearchScreen;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  it('renders search screen with input and results container', async () => {
    await loadSearchScreen([], vi.fn());

    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    expect(input).toBeTruthy();
    expect(results).toBeTruthy();
  });

  it('handles empty video list', async () => {
    await loadSearchScreen([], vi.fn());

    const container = document.getElementById('screen-search');
    expect(container).toBeTruthy();
  });

  it('handles missing container gracefully', async () => {
    resetDOM();
    await expect(loadSearchScreen([], vi.fn())).resolves.toBeUndefined();
  });
});

// ─── SettingsScreen interaction ───────────────────────────────────────────────

describe('Tizen SettingsScreen loader interaction', () => {
  let loadSettingsScreen: typeof import('../../../src/screens/SettingsScreen').loadSettingsScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM('<div id="screen-settings" class="screen"></div>');
    loadSettingsScreen = (await import('../../../src/screens/SettingsScreen')).loadSettingsScreen;
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  it('renders settings screen with correct DOM structure', async () => {
    await loadSettingsScreen(mockStorage());

    const container = document.getElementById('screen-settings');
    expect(container).toBeTruthy();
    // Should contain settings-related content
    expect(container?.innerHTML.length).toBeGreaterThan(0);
  });

  it('handles missing container gracefully', async () => {
    resetDOM();
    await expect(loadSettingsScreen(mockStorage())).resolves.toBeUndefined();
  });
});
