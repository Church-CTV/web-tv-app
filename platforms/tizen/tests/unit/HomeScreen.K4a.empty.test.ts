/**
 * K4a: Home feed empty state (Tizen) — TDD RED first.
 *
 * Proves that when the feed is valid but contains zero videos,
 * Tizen loadMainView renders an intentional empty state (`.home-empty-state`)
 * instead of a blank grid.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @ctv/core: keep real implementations, mock get and getServerBaseUrl.
vi.mock('@ctv/core', async () => {
  const actual = await vi.importActual<typeof import('@ctv/core')>('@ctv/core');
  return {
    ...actual,
    getServerBaseUrl: vi.fn(() => 'http://test-server'),
    get: vi.fn(),
  };
});

describe('K4a: Home feed empty state (Tizen)', () => {
  let consoleSpyErr: ReturnType<typeof vi.spyOn>;
  let consoleSpyLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="content-grid" class="screen screen-active"></div>
      <div id="left-nav" class="screen"></div>
    `;
    consoleSpyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleSpyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.clearAllMocks();
    void consoleSpyErr;
    void consoleSpyLog;
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

  it('renders empty state element when feed is valid with zero videos', async () => {
    const { get } = await import('@ctv/core');

    // Valid feed (passes validateFeed) but no month entries -> 0 videos.
    (get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        providerName: 'Test Channel',
        lastUpdated: '2026-01-01T00:00:00Z',
        language: 'en',
        cardStyle: {},
        config: {},
      },
      status: 200,
    });

    const { loadMainView } = await import('../../src/screens/HomeScreen');
    await loadMainView(storage as never, null, actions as never);

    const gridContainer = document.getElementById('content-grid')!;
    const emptyEl = gridContainer.querySelector('.home-empty-state');
    expect(emptyEl).not.toBeNull();
    expect(emptyEl!.getAttribute('role')).toBe('status');

    // No content cards rendered.
    expect(gridContainer.querySelector('[data-video-id]')).toBeNull();
  });

  it('displays empty title and hint text', async () => {
    const { get } = await import('@ctv/core');

    (get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        providerName: 'Test Channel',
        lastUpdated: '2026-01-01T00:00:00Z',
        language: 'en',
        cardStyle: {},
        config: {},
      },
      status: 200,
    });

    const { loadMainView } = await import('../../src/screens/HomeScreen');
    await loadMainView(storage as never, null, actions as never);

    const gridContainer = document.getElementById('content-grid')!;
    const titleEl = gridContainer.querySelector('.home-empty-state__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe('No content available');

    const hintEl = gridContainer.querySelector('.home-empty-state__hint');
    expect(hintEl).not.toBeNull();
    expect(hintEl!.textContent).toBe('Content from your channel will appear here.');
  });

  it('calls onFeedLoaded with empty list on empty feed', async () => {
    const { get } = await import('@ctv/core');

    (get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        providerName: 'Test Channel',
        lastUpdated: '2026-01-01T00:00:00Z',
        language: 'en',
        cardStyle: {},
        config: {},
      },
      status: 200,
    });

    const onFeedLoaded = vi.fn();
    const { loadMainView } = await import('../../src/screens/HomeScreen');
    await loadMainView(storage as never, null, { ...actions, onFeedLoaded } as never);

    expect(onFeedLoaded).toHaveBeenCalledTimes(1);
    expect(onFeedLoaded).toHaveBeenCalledWith([]);
  });
});
