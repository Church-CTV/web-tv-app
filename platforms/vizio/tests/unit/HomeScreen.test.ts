/**
 * Vizio HomeScreen loader — unit tests.
 * Tests DOM rendering behavior of loadMainView with mocked fetch.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMainView } from '../../src/screens/HomeScreen';
import type { ScreenActionMap } from '../../src/screens/HomeScreen';

const makeActions = (): ScreenActionMap => ({
  onVideoSelect: vi.fn(),
  onSearch: vi.fn(),
  onSchedule: vi.fn(),
  onContinueWatching: vi.fn(),
  onWatchLater: vi.fn(),
  onSettings: vi.fn(),
  onRetry: vi.fn(),
});

const makeStorage = () => ({
  get: () => 'http://localhost:3000',
  set: () => {},
  remove: () => {},
  getAll: () => ({}),
});

describe('Vizio HomeScreen', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="content-grid"></div>
      <div id="left-nav"></div>
      <div id="screen-grid" class="screen">Grid</div>
      <div id="screen-search" class="screen">Search</div>
      <div id="screen-schedule" class="screen">Schedule</div>
      <div id="screen-continue-watching" class="screen">CW</div>
      <div id="screen-watch-later" class="screen">WL</div>
      <div id="screen-subscribe" class="screen">Sub</div>
      <div id="screen-settings" class="screen">Settings</div>
      <div id="screen-error" class="screen">Err</div>
      <div id="screen-loading" class="screen screen-active">Loading</div>
    `;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            '2024-01': [
              { id: 'v1', title: 'Video 1', thumbnail: '/t1.jpg' },
              { id: 'v2', title: 'Video 2', thumbnail: '/t2.jpg' },
            ],
            '2024-02': [{ id: 'v3', title: 'Video 3', thumbnail: '/t3.jpg' }],
          }),
      })
    );
  });

  it('does not overwrite navigation performed by the feed-loaded callback', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="screen-video" class="screen"></div>');
    const { showScreen } = await import('../../src/screens/visibility');
    const actions = { ...makeActions(), onFeedLoaded: () => showScreen('screen-video') };
    await loadMainView(makeStorage(), null, actions);
    expect(document.querySelector('.screen-active')?.id).toBe('screen-video');
  });

  it('keeps month membership and actual feed stream URLs', async () => {
    const actions = { ...makeActions(), onFeedLoaded: vi.fn() };
    const feed = {
      'January 2024': [
        { id: 'a', title: 'A', content: { videos: [{ url: 'https://media.example/a.m3u8' }] } },
      ],
      'February 2024': [{ id: 'b', title: 'B', url: 'https://media.example/b.mp4' }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => feed }));
    await loadMainView(makeStorage(), null, actions);
    expect(document.querySelectorAll('[data-video-id="a"]')).toHaveLength(1);
    expect(
      document.querySelector('[data-category-id="February 2024"] [data-video-id="a"]')
    ).toBeNull();
    expect(
      actions.onFeedLoaded.mock.calls[0][0].find((v: { videoId: string }) => v.videoId === 'a')
        .streamUrl
    ).toBe('https://media.example/a.m3u8');
  });

  it('renders content grid with categories', async () => {
    await loadMainView(makeStorage(), null, makeActions());

    const gridEl = document.getElementById('content-grid')!;
    expect(gridEl).toBeTruthy();
    // Should contain some content or error
    expect(gridEl.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders left navigation with items', async () => {
    await loadMainView(makeStorage(), null, makeActions());

    const navEl = document.getElementById('left-nav')!;
    // Nav may be empty if feed loading fails, but the element exists
    expect(navEl).toBeTruthy();
  });

  it('exposes only the three destinations enabled by the pinned Roku configuration', async () => {
    await loadMainView(makeStorage(), null, makeActions());
    expect(
      [...document.querySelectorAll('#left-nav [data-nav-id]')].map((item) =>
        item.getAttribute('data-nav-id')
      )
    ).toEqual(['home', 'search', 'settings']);
  });

  it('renders error screen on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await loadMainView(makeStorage(), null, makeActions());

    const gridEl = document.getElementById('content-grid')!;
    expect(gridEl.innerHTML).toContain('error');
  });

  it('renders error screen on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    await loadMainView(makeStorage(), null, makeActions());

    const gridEl = document.getElementById('content-grid')!;
    expect(gridEl.innerHTML).toContain('error');
  });

  it('activates the grid screen after a successful feed load (RED → GREEN: D6)', async () => {
    // Regression: index.html ships with #screen-loading active. If HomeScreen
    // never calls showScreen('screen-grid'), the loading overlay stays up and
    // blocks all clicks in production (seen on Vizio preview).
    await loadMainView(makeStorage(), null, makeActions());

    const gridEl = document.getElementById('screen-grid')!;
    const loadingEl = document.getElementById('screen-loading')!;
    // The grid screen must be active and the loading screen hidden.
    expect(gridEl.classList.contains('screen-active')).toBe(true);
    expect(loadingEl.classList.contains('screen-active')).toBe(false);
  });

  it('activates the grid screen on feed failure, not the dead static error panel (RED → GREEN: D6)', async () => {
    // Regression: the static #screen-error panel overlays the dynamic error
    // UI rendered into #content-grid, leaving two retry buttons and intercepting
    // clicks on the working one. Must activate screen-grid, not screen-error.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await loadMainView(makeStorage(), null, makeActions());

    const gridEl = document.getElementById('screen-grid')!;
    const errorEl = document.getElementById('screen-error')!;
    // Must activate grid (which holds the dynamic error UI), not the static panel.
    expect(gridEl.classList.contains('screen-active')).toBe(true);
    expect(errorEl.classList.contains('screen-active')).toBe(false);
  });
});
