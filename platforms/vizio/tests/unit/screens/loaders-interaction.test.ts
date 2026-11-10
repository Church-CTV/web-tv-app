/**
 * Vizio HomeScreen loader — interaction tests.
 * Verifies left-nav and content-grid callbacks actually work (TDD: these fail
 * on the dead-callback bug where initLeftNav is never called and initContentGrid
 * is called without onVideoSelect).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@ctv/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ctv/core')>();
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

const FEED = {
  'January 2024': [
    { id: 'v1', title: 'Video One', thumbnail: '/t1.jpg' },
    { id: 'v2', title: 'Video Two', thumbnail: '/t2.jpg' },
  ],
};

function makeActions() {
  return {
    onVideoSelect: vi.fn(),
    onSearch: vi.fn(),
    onSchedule: vi.fn(),
    onContinueWatching: vi.fn(),
    onWatchLater: vi.fn(),
    onSettings: vi.fn(),
    onRetry: vi.fn(),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Vizio HomeScreen loader interactions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetDOM(`
      <div id="content-grid" class="screen"></div>
      <div id="left-nav"></div>
      <div id="screen-grid" class="screen"></div>
      <div id="screen-search" class="screen"></div>
      <div id="screen-schedule" class="screen"></div>
      <div id="screen-continue-watching" class="screen"></div>
      <div id="screen-watch-later" class="screen"></div>
      <div id="screen-subscribe" class="screen"></div>
      <div id="screen-settings" class="screen"></div>
    `);
    // HomeScreen uses @ctv/core get(), not raw fetch
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      data: FEED,
    });
  });

  afterEach(() => {
    resetDOM();
    vi.unstubAllGlobals();
  });

  async function loadMain() {
    const mod = await import('../../../src/screens/HomeScreen');
    const actions = makeActions();
    await mod.loadMainView(mockStorage({ ctv_server_url: 'http://localhost:3000' }), null, actions);
    return actions;
  }

  it('wires left-nav buttons so clicking triggers the matching action', async () => {
    const actions = await loadMain();

    // Nav buttons should be present in #left-nav
    const navEl = document.getElementById('left-nav')!;
    const searchBtn = navEl.querySelector('[data-nav-id="search"]') as HTMLButtonElement;
    expect(searchBtn, 'search nav button should exist').not.toBeNull();

    // Clicking search should call actions.onSearch
    searchBtn.click();
    expect(actions.onSearch).toHaveBeenCalled();
  });

  it('wires Settings while restricting the rail to the three enabled Roku destinations', async () => {
    const actions = await loadMain();
    const navEl = document.getElementById('left-nav')!;
    const ids = Array.from(navEl.querySelectorAll('[data-nav-id]'), (el) =>
      el.getAttribute('data-nav-id')
    );
    expect(ids).toEqual(['home', 'search', 'settings']);
    (navEl.querySelector('[data-nav-id="settings"]') as HTMLButtonElement).click();
    expect(actions.onSettings).toHaveBeenCalledTimes(1);
    expect(actions.onSchedule).not.toHaveBeenCalled();
    expect(actions.onContinueWatching).not.toHaveBeenCalled();
    expect(actions.onWatchLater).not.toHaveBeenCalled();
  });

  it('wires home nav button to showScreen("screen-grid")', async () => {
    const visMod = await import('../../../src/screens/visibility');
    vi.spyOn(visMod, 'showScreen').mockImplementation(() => {});

    await loadMain();
    const navEl = document.getElementById('left-nav')!;
    (navEl.querySelector('[data-nav-id="home"]') as HTMLButtonElement).click();

    expect(visMod.showScreen).toHaveBeenCalledWith('screen-grid');
  });

  it('calls onVideoSelect when a content card is clicked', async () => {
    const actions = await loadMain();

    // Content grid should contain cards with data-video-id
    const gridEl = document.getElementById('content-grid')!;
    const card = gridEl.querySelector('[data-video-id]') as HTMLElement;
    expect(card, 'content card should exist in grid').not.toBeNull();

    card.click();
    expect(actions.onVideoSelect).toHaveBeenCalledTimes(1);
    expect(actions.onVideoSelect).toHaveBeenCalledWith(
      card.getAttribute('data-video-id'),
      expect.any(String)
    );
  });

  it('calls onFeedLoaded with all feed videos after load', async () => {
    vi.clearAllMocks();
    resetDOM(`
      <div id="content-grid" class="screen"></div>
      <div id="left-nav"></div>
      <div id="screen-grid" class="screen"></div>
    `);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(FEED) })
    );

    const mod = await import('../../../src/screens/HomeScreen');
    const onFeedLoaded = vi.fn();
    const actions = { ...makeActions(), onFeedLoaded };

    await mod.loadMainView(mockStorage({ ctv_server_url: 'http://localhost:3000' }), null, actions);

    expect(onFeedLoaded).toHaveBeenCalledTimes(1);
    const videos = onFeedLoaded.mock.calls[0][0] as Array<{ videoId: string; title: string }>;
    expect(videos).toHaveLength(2);
    expect(videos[0].videoId).toBe('v1');
    expect(videos[0].title).toBe('Video One');
  });

  it('tracks navigation interactions when analytics is provided', async () => {
    vi.clearAllMocks();
    resetDOM(`
      <div id="content-grid" class="screen"></div>
      <div id="left-nav"></div>
      <div id="screen-grid" class="screen"></div>
      <div id="screen-search" class="screen"></div>
    `);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(FEED) })
    );

    const analytics = { trackInteraction: vi.fn() };
    const mod = await import('../../../src/screens/HomeScreen');
    await mod.loadMainView(
      mockStorage({ ctv_server_url: 'http://localhost:3000' }),
      analytics,
      makeActions()
    );

    const navEl = document.getElementById('left-nav')!;
    (navEl.querySelector('[data-nav-id="search"]') as HTMLButtonElement).click();
    expect(analytics.trackInteraction).toHaveBeenCalledWith('navigate', 'search');
  });

  it('returns early when the content-grid container is missing', async () => {
    vi.clearAllMocks();
    resetDOM();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(FEED) })
    );
    const mod = await import('../../../src/screens/HomeScreen');
    await expect(mod.loadMainView(mockStorage(), null, makeActions())).resolves.toBeUndefined();
  });

  it('handles an empty feed without crashing', async () => {
    vi.clearAllMocks();
    resetDOM(`<div id="content-grid" class="screen"></div><div id="left-nav"></div>`);
    const { get } = await import('@ctv/core');
    (get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, data: {} });
    const mod = await import('../../../src/screens/HomeScreen');
    await expect(mod.loadMainView(mockStorage(), null, makeActions())).resolves.toBeUndefined();
    expect(get).toHaveBeenCalled();
  });
});
