/**
 * K4a: Home feed empty state (webOS) — TDD RED first.
 *
 * Proves that when the feed is valid but contains zero videos,
 * loadMainView renders an intentional empty state (`.home-empty-state`)
 * instead of a blank grid.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @ctv/core: keep real mapHttpError/isUserFacingError/HttpError, mock get and helpers
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    ...actual,
    getServerBaseUrl: vi.fn(() => 'http://test-server'),
    get: vi.fn(),
    validateFeed: vi.fn((feed: Record<string, unknown>) => ({
      valid: true,
      errors: [],
      warnings: [],
      videoCount: 0,
    })),
    getMonthKeys: vi.fn(() => [] as string[]),
    groupVideosByMonth: vi.fn(() => ({})),
  };
});

vi.mock('../../../src/ui/ContentGrid', () => ({
  createContentGrid: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'content-grid';
    return el;
  }),
  focusFirstCard: vi.fn(),
}));

vi.mock('../../../src/ui/LeftNav', () => ({
  createLeftNav: vi.fn(() => {
    const el = document.createElement('nav');
    el.className = 'left-nav';
    return el;
  }),
}));

describe('K4a: Home feed empty state (webOS)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="content-grid" class="screen screen-active"></div>
      <div id="left-nav" class="screen"></div>
    `;
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.clearAllMocks();
    void consoleSpy;
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

  it('renders empty state element when feed is valid with zero videos', async () => {
    const { get, getMonthKeys, groupVideosByMonth, validateFeed } = await import('@ctv/core');

    // Valid feed but no month keys / no videos
    (validateFeed as ReturnType<typeof vi.fn>).mockReturnValue({
      valid: true,
      errors: [],
      warnings: ['No month keys found in feed'],
      videoCount: 0,
    });
    (getMonthKeys as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (groupVideosByMonth as ReturnType<typeof vi.fn>).mockReturnValue({});
    (get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        providerName: 'Test',
        lastUpdated: '2026-01-01',
        language: 'en',
        cardStyle: {},
        config: {},
      },
      status: 200,
    });

    const { loadMainView } = await import('../../../src/screens/HomeScreen');
    await loadMainView(storage as never, { trackInteraction: vi.fn() }, actions as never);

    const gridContainer = document.getElementById('content-grid')!;

    // Empty state element must be present
    const emptyEl = gridContainer.querySelector('.home-empty-state');
    expect(emptyEl).not.toBeNull();
    expect(emptyEl!.getAttribute('role')).toBe('status');

    // Must not render a content grid with zero videos
    expect(gridContainer.querySelector('.content-grid')).toBeNull();

    // Must not still show the loading placeholder
    expect(gridContainer.innerHTML).not.toContain('loading.content');
  });

  it('displays localized empty title text', async () => {
    const { get, getMonthKeys, groupVideosByMonth } = await import('@ctv/core');

    (getMonthKeys as ReturnType<typeof vi.fn>).mockReturnValue(['2026-07']);
    (groupVideosByMonth as ReturnType<typeof vi.fn>).mockReturnValue({ '2026-07': [] });
    (get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { '2026-07': [] },
      status: 200,
    });

    const { loadMainView } = await import('../../../src/screens/HomeScreen');
    await loadMainView(storage as never, null, actions as never);

    const gridContainer = document.getElementById('content-grid')!;
    const titleEl = gridContainer.querySelector('.home-empty-state__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe('No content available');

    const hintEl = gridContainer.querySelector('.home-empty-state__hint');
    expect(hintEl).not.toBeNull();
    expect(hintEl!.textContent).toBe('Content from your channel will appear here.');
  });

  it('still calls onFeedLoaded with empty video list', async () => {
    const { get, getMonthKeys, groupVideosByMonth } = await import('@ctv/core');

    (getMonthKeys as ReturnType<typeof vi.fn>).mockReturnValue(['2026-07']);
    (groupVideosByMonth as ReturnType<typeof vi.fn>).mockReturnValue({ '2026-07': [] });
    (get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { '2026-07': [] },
      status: 200,
    });

    const onFeedLoaded = vi.fn();
    const { loadMainView } = await import('../../../src/screens/HomeScreen');
    await loadMainView(storage as never, null, { ...actions, onFeedLoaded } as never);

    expect(onFeedLoaded).toHaveBeenCalledTimes(1);
    expect(onFeedLoaded).toHaveBeenCalledWith([]);
  });
});
