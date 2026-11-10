/**
 * screens/ — unit tests for screen loader wrapper functions.
 * Tests that each loader correctly fetches data and renders to the DOM.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock core getServerBaseUrl
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    get: vi.fn(),
    getServerBaseUrl: vi.fn(() => 'http://localhost:3000'),
    mapHttpError: actual.mapHttpError,
    isUserFacingError: actual.isUserFacingError,
    isRetryable: actual.isRetryable,
    HttpError: actual.HttpError,
  };
});

// Mock visibility
vi.mock('../../../src/screens/visibility', () => ({
  showScreen: vi.fn(),
  hideScreen: vi.fn(),
}));

// Mock ui SettingsScreen
const uiSettingsMock = {
  renderSettingsScreen: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'settings-screen';
    el.innerHTML =
      '<div class="settings-content"><a class="settings-give__link" href="https://giving.example.test/donate">Give</a></div>';
    return el;
  }),
  initSettingsScreen: vi.fn((_storage, onRetry) => {
    const retryBtn = document.getElementById('btn-retry-settings');
    if (retryBtn && onRetry) retryBtn.addEventListener('click', onRetry);
  }),
};
vi.mock('../../../src/ui/SettingsScreen', () => uiSettingsMock);

// Mock ui SearchScreen
const uiSearchMock = {
  createSearchScreen: vi.fn(({ videos, onVideoSelect }) => {
    const el = document.createElement('div');
    el.className = 'search-screen';
    for (const v of videos) {
      const card = document.createElement('div');
      card.className = 'search-result';
      card.setAttribute('data-video-id', v.id);
      card.textContent = v.title;
      card.addEventListener('click', () => onVideoSelect(v.id));
      el.appendChild(card);
    }
    return el;
  }),
};
vi.mock('../../../src/ui/SearchScreen', () => uiSearchMock);

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SettingsScreen loader', () => {
  let loadSettingsScreen: typeof import('../../../src/screens/SettingsScreen').loadSettingsScreen;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="screen-settings" class="screen"></div>';
    vi.clearAllMocks();
    loadSettingsScreen = (await import('../../../src/screens/SettingsScreen')).loadSettingsScreen;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders settings screen UI', async () => {
    uiSettingsMock.renderSettingsScreen.mockClear();

    await loadSettingsScreen({
      get: () => null,
      set: () => {},
      remove: () => {},
      getAll: () => ({}),
    });

    const container = document.getElementById('screen-settings');
    expect(container).toBeTruthy();
    expect(uiSettingsMock.renderSettingsScreen).toHaveBeenCalled();
    expect(uiSettingsMock.initSettingsScreen).not.toHaveBeenCalled();
    expect(container?.querySelector('.settings-give__link')).toBe(document.activeElement);
    expect(container?.querySelector('.settings-screen')).not.toBeNull();
  });

  it('handles missing container gracefully', async () => {
    document.body.innerHTML = '';
    await loadSettingsScreen({
      get: () => null,
      set: () => {},
      remove: () => {},
      getAll: () => ({}),
    });
    // Should not throw
  });
});

describe('SearchScreen loader', () => {
  let loadSearchScreen: typeof import('../../../src/screens/SearchScreen').loadSearchScreen;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="screen-search" class="screen"></div>';
    vi.clearAllMocks();
    loadSearchScreen = (await import('../../../src/screens/SearchScreen')).loadSearchScreen;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('converts FeedVideo to VideoItem and renders search screen', async () => {
    const videos = [
      { videoId: 'v1', title: 'Video One', thumbnail: '/img1.jpg', progress: 0 },
      { videoId: 'v2', title: 'Video Two', thumbnail: '/img2.jpg', progress: 50 },
    ];
    uiSearchMock.createSearchScreen.mockClear();

    await loadSearchScreen(videos, vi.fn());

    expect(uiSearchMock.createSearchScreen).toHaveBeenCalled();
    const callArg = vi.mocked(uiSearchMock.createSearchScreen).mock.calls[0][0];
    expect(callArg.videos).toHaveLength(2);
    expect(callArg.videos[0].id).toBe('v1');
    expect(callArg.videos[0].title).toBe('Video One');
    expect(callArg.videos[0].url).toBe('/stream/v1.mp4');
  });

  it('handles empty video list', async () => {
    uiSearchMock.createSearchScreen.mockClear();

    await loadSearchScreen([], vi.fn());

    expect(uiSearchMock.createSearchScreen).toHaveBeenCalled();
    const callArg = vi.mocked(uiSearchMock.createSearchScreen).mock.calls[0][0];
    expect(callArg.videos).toHaveLength(0);
  });

  it('handles missing container gracefully', async () => {
    document.body.innerHTML = '';
    await loadSearchScreen([], vi.fn());
    // Should not throw
  });
});
