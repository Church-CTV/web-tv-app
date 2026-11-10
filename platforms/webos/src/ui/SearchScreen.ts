/**
 * SearchScreen — Full-screen search with results grid.
 * Provides a remote-friendly search surface.
 */

import { searchVideos } from '@ctv/core';
import { SEARCH_PROMPT } from '@ctv/shared/ui/SearchPrompt';
import type { VideoItem } from '@ctv/core';
import { createContentCard } from './ContentCard';
import { getPlatformI18n } from '../utils/PlatformI18n';

export interface SearchScreenProps {
  videos: VideoItem[];
  onVideoSelect: (videoId: string) => void;
  onBack?: () => void;
}

/**
 * Debounce with cleanup support.
 * Returns a debounced function that can be cancelled via cleanup.
 */
interface DebouncedWithCleanup {
  (query: string): void;
  cleanup: () => void;
}

function createDebouncedWithCleanup(
  fn: (query: string) => void,
  delay: number
): DebouncedWithCleanup {
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  // Create the callable function first
  function debounced(query: string): void {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      fn(query);
    }, delay);
  }

  // Attach cleanup method
  debounced.cleanup = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };

  return debounced as DebouncedWithCleanup;
}

/**
 * Create a SearchScreen component.
 * Renders a search input with debounced search and results grid.
 * Returns the root element with a cleanup function to cancel pending timers.
 */
export function createSearchScreen(
  props: SearchScreenProps
): HTMLDivElement & { cleanup: () => void } {
  const screen = document.createElement('div');
  screen.className = 'search-screen';

  // Custom keyboard provides remote-only entry.
  const i18n = getPlatformI18n();
  const title = document.createElement('h2');
  title.className = 'search-screen__title';
  title.textContent = 'Search';
  screen.appendChild(title);

  // Search input (the visible query field that the keyboard feeds)
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'search-screen__input';
  searchInput.placeholder = i18n.t('search.placeholder');
  searchInput.setAttribute('aria-label', i18n.t('search.aria_label'));
  searchInput.setAttribute('role', 'searchbox');
  screen.appendChild(searchInput);

  // On-screen QWERTY keyboard. Feeds the input and
  // triggers the same debounced search on every key press.
  const osk = buildOnScreenKeyboard();
  screen.appendChild(osk.el);

  // Results container
  const resultsContainer = document.createElement('div');
  resultsContainer.className = 'search-screen__results';
  resultsContainer.setAttribute('role', 'group');
  resultsContainer.setAttribute('aria-label', 'Search results');
  screen.appendChild(resultsContainer);
  resultsContainer.innerHTML = SEARCH_PROMPT;

  // Debounced search function with cleanup support
  const debouncedSearch = createDebouncedWithCleanup((query: string) => {
    if (!query.trim()) {
      resultsContainer.innerHTML = SEARCH_PROMPT;
      return;
    }
    const results = searchVideos(props.videos, query);
    renderResults(results, resultsContainer, props.onVideoSelect);
  }, 300);

  // Central "apply query" path: update the input, re-run the debounced search.
  // Both the on-screen keys and real keyboard input flow through here.
  const applyQuery = (next: string): void => {
    searchInput.value = next;
    debouncedSearch(next);
  };

  // Search on real keyboard input into the field
  const onInput = (e: Event) => {
    const query = (e.target as HTMLInputElement).value;
    debouncedSearch(query);
  };
  searchInput.addEventListener('input', onInput);

  // Keyboard: Enter submits, Escape clears
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      applyQuery('');
    }
  };
  searchInput.addEventListener('keydown', onKeydown);

  // Wire on-screen keys to the query + debounced search
  osk.bind((action, ch) => {
    if (action === 'append') applyQuery(searchInput.value + ch);
    else if (action === 'back') applyQuery(searchInput.value.slice(0, -1));
    else if (action === 'clear') applyQuery('');
  });

  // Focus input on screen load
  searchInput.focus();

  // Attach cleanup function to the returned element
  (screen as HTMLDivElement & { cleanup: () => void }).cleanup = () => {
    debouncedSearch.cleanup();
    searchInput.removeEventListener('keydown', onKeydown);
    searchInput.removeEventListener('input', onInput);
  };

  return screen as HTMLDivElement & { cleanup: () => void };
}

// ─── On-screen keyboard ─────────────────────────────

const OSK_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ['space', 'back', 'clear'],
];

type OsKeyAction = 'append' | 'back' | 'clear';

function oskKeyLabel(k: string): string {
  if (k === 'space') return 'Space';
  if (k === 'back') return '⌫';
  if (k === 'clear') return 'Clear';
  return k.toUpperCase();
}

/**
 * Build a visible on-screen QWERTY keyboard.
 * `bind` is invoked for each key press with the key action and (for letters)
 * the lowercase character. Returns the keyboard root element.
 */
function buildOnScreenKeyboard(): {
  el: HTMLElement;
  bind: (cb: (action: OsKeyAction, ch: string) => void) => void;
} {
  const osk = document.createElement('div');
  osk.className = 'osk';
  osk.setAttribute('role', 'group');
  osk.setAttribute('aria-label', 'On-screen keyboard');

  let handler: ((action: OsKeyAction, ch: string) => void) | null = null;

  for (const row of OSK_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'osk-row';
    for (const k of row) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `osk-key osk-key--${k}`;
      btn.setAttribute('data-key', k);
      btn.tabIndex = 0;
      btn.textContent = oskKeyLabel(k);
      if (k === 'back') {
        btn.setAttribute('aria-label', 'Delete');
        btn.innerHTML =
          '<svg aria-hidden="true" width="26" height="22" viewBox="0 0 26 22" fill="none"><path d="M10 2H24V20H10L2 11Z M13 7L20 15 M20 7L13 15" stroke="currentColor" stroke-width="2"/></svg>';
      }
      const fire = (): void => {
        if (!handler) return;
        if (k === 'space') handler('append', ' ');
        else if (k === 'back' || k === 'clear') handler(k, '');
        else handler('append', k);
      };
      btn.addEventListener('click', fire);
      btn.addEventListener('keydown', (e) => {
        if (!e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          fire();
        }
      });
      rowEl.appendChild(btn);
    }
    osk.appendChild(rowEl);
  }

  // Navigate logical rows without depending on browser layout measurements.
  // Let outer-edge arrows and Back continue to the app's navigation handler.
  osk.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const key = (event.target as HTMLElement).closest<HTMLButtonElement>('.osk-key');
    if (!key) return;
    const rows = Array.from(osk.querySelectorAll('.osk-row'));
    const row = key.parentElement!;
    const rowIndex = rows.indexOf(row);
    const keys = Array.from(row.querySelectorAll<HTMLButtonElement>('.osk-key'));
    const column = keys.indexOf(key);
    let next: HTMLButtonElement | undefined;
    if (event.key === 'ArrowLeft') next = keys[column - 1];
    else if (event.key === 'ArrowRight') next = keys[column + 1];
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const nextRow = rows[rowIndex + (event.key === 'ArrowUp' ? -1 : 1)];
      const nextKeys = nextRow
        ? Array.from(nextRow.querySelectorAll<HTMLButtonElement>('.osk-key'))
        : [];
      next = nextKeys[Math.min(column, nextKeys.length - 1)];
    }
    if (next) {
      event.preventDefault();
      event.stopPropagation();
      next.focus();
    }
  });

  return {
    el: osk,
    bind: (cb) => {
      handler = cb;
    },
  };
}

/**
 * Render search results as a grid of content cards.
 */
function renderResults(
  results: Array<{ video: VideoItem; score: number }>,
  container: HTMLDivElement,
  onVideoSelect: (videoId: string) => void
): void {
  // Clear existing results
  container.innerHTML = '';

  if (results.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'search-screen__no-results';
    noResults.textContent = getPlatformI18n().t('search.no_results');
    container.appendChild(noResults);
    return;
  }

  // Render each result as a content card
  for (const result of results) {
    const card = createContentCard({
      videoId: result.video.id,
      title: result.video.title,
      thumbnail: result.video.thumbnail,
      isActive: false,
    });
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => onVideoSelect(result.video.id));
    container.appendChild(card);
  }
}

/**
 * Update the search screen with new video data.
 */
export function updateSearchScreen(
  screen: HTMLDivElement,
  videos: VideoItem[],
  onVideoSelect: (videoId: string) => void
): void {
  const input = screen.querySelector('.search-screen__input') as HTMLInputElement;
  if (input) {
    const query = input.value;
    const results = searchVideos(videos, query);
    const container = screen.querySelector('.search-screen__results') as HTMLDivElement;
    renderResults(results, container, onVideoSelect);
  }
}

/**
 * Focus the search input.
 */
export function focusSearchInput(screen: HTMLDivElement): void {
  const input = screen.querySelector('.search-screen__input') as HTMLElement;
  if (input) {
    input.focus();
  }
}
