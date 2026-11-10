/**
 * Tizen SearchScreen — OSK (on-screen keyboard) interaction tests.
 *
 * Exercises the real search pipeline: key clicks → debounced apply() →
 * runSearch() → renderResults() with the genuine core searchVideos().
 * Uses fake timers for the 200ms debounce so tests stay deterministic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSearchScreen } from '../../src/screens/SearchScreen';

interface MiniVideo {
  id: string;
  title: string;
  shortDescription: string;
  hdPosterUrl: string;
  sdPosterUrl: string;
}

const VIDEOS: MiniVideo[] = [
  {
    id: 'v1',
    title: 'Prayer Guide',
    shortDescription: 'A guided prayer session',
    hdPosterUrl: 'h1',
    sdPosterUrl: 's1',
  },
  {
    id: 'v2',
    title: 'Sunday Sermon',
    shortDescription: 'Weekly message',
    hdPosterUrl: 'h2',
    sdPosterUrl: 's2',
  },
];

function clickKey(key: string): void {
  (document.querySelector(`.osk-key[data-key="${key}"]`) as HTMLButtonElement).click();
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="screen-search" class="screen-active"></div>';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('SearchScreen OSK input', () => {
  it('focuses the first key after load', async () => {
    await loadSearchScreen(VIDEOS, vi.fn());
    const first = document.querySelector('.osk-key') as HTMLElement;
    expect(document.activeElement).toBe(first);
  });

  it('appends typed letters to the query (debounced)', async () => {
    await loadSearchScreen(VIDEOS, vi.fn());
    clickKey('p');
    clickKey('r');
    expect(document.getElementById('search-query')?.textContent).toBe('pr');
    vi.advanceTimersByTime(250);
    // "pr" matches "Prayer Guide"
    const cards = document.querySelectorAll('#search-results [data-video-id]');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-video-id')).toBe('v1');
  });

  it('backspace removes the last letter (debounced)', async () => {
    await loadSearchScreen(VIDEOS, vi.fn());
    clickKey('p');
    clickKey('r');
    clickKey('a');
    vi.advanceTimersByTime(250);
    expect(document.getElementById('search-query')?.textContent).toBe('pra');

    clickKey('back');
    vi.advanceTimersByTime(250);
    expect(document.getElementById('search-query')?.textContent).toBe('pr');
  });

  it('space inserts a literal space (debounced)', async () => {
    await loadSearchScreen(VIDEOS, vi.fn());
    clickKey('p');
    clickKey('space');
    vi.advanceTimersByTime(250);
    expect(document.getElementById('search-query')?.textContent).toBe('p ');
  });

  it('clear resets the query and results (debounced)', async () => {
    await loadSearchScreen(VIDEOS, vi.fn());
    clickKey('p');
    vi.advanceTimersByTime(250);
    expect(document.querySelectorAll('#search-results [data-video-id]')).toHaveLength(1);

    clickKey('clear');
    vi.advanceTimersByTime(250);
    expect(document.getElementById('search-query')?.textContent).toBe('');
    // Empty queries restore guidance; only unsuccessful nonempty queries show no results.
    expect(document.querySelector('#search-results .search-prompt')?.textContent).toContain(
      'Find a message'
    );
  });

  it('debounces rapid key presses into a single search', async () => {
    const { searchVideos } = await import('@ctv/core');
    const spy = vi.spyOn(await import('@ctv/core'), 'searchVideos');
    await loadSearchScreen(VIDEOS, vi.fn());
    clickKey('p');
    clickKey('r');
    clickKey('a');
    vi.advanceTimersByTime(250);
    // Three keys inside the debounce window → one search for the final query
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.any(Array), 'pra');
    void searchVideos;
  });

  it('shows the empty state when nothing matches', async () => {
    await loadSearchScreen(VIDEOS, vi.fn());
    clickKey('z');
    clickKey('z');
    vi.advanceTimersByTime(250);
    expect(document.querySelector('#search-results .search-screen__no-results')?.textContent).toBe(
      'No results found'
    );
    expect(document.querySelectorAll('#search-results [data-video-id]')).toHaveLength(0);
  });
});

describe('SearchScreen result selection', () => {
  it('calls onVideoSelect with the matching video id and title', async () => {
    const onVideoSelect = vi.fn();
    await loadSearchScreen(VIDEOS, onVideoSelect);
    clickKey('p');
    vi.advanceTimersByTime(250);

    const card = document.querySelector('#search-results [data-video-id="v1"]') as HTMLElement;
    expect(card).toBeTruthy();
    card.click();
    expect(onVideoSelect).toHaveBeenCalledWith('v1', 'Prayer Guide');
  });

  it('renders multiple ranked results', async () => {
    await loadSearchScreen(VIDEOS, vi.fn());
    // "pr" matches both "Prayer Guide" and "Sunday Sermon"? No — only Prayer.
    // Use "er" → matches both "Prayer" and "Sermon" → two ranked results.
    clickKey('e');
    clickKey('r');
    vi.advanceTimersByTime(250);
    const cards = document.querySelectorAll('#search-results [data-video-id]');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards[0].getAttribute('role')).toBe('button');
  });
});
