/**
 * Shared SearchScreen — full-screen search with results grid.
 * Used by all three platforms (webOS, Tizen, Vizio).
 */

import { debounce, searchVideos } from '@ctv/core';
import type { VideoItem } from '@ctv/core';
import type { SharedVideoItem } from './ContentCard';
import { renderContentCard } from './ContentCard';

export interface SearchScreenProps {
  videos: VideoItem[];
  onVideoSelect: (videoId: string) => void;
  onBack?: () => void;
}

/**
 * Render the search screen as HTML string.
 */
export function renderSearchScreen(_props: SearchScreenProps): string {
  return `<div class="search-screen" id="search-screen">
    <h2 class="search-screen__title">Search</h2>
    <input class="search-screen__input" type="search" id="search-input" placeholder="Search videos..." aria-label="Search videos" role="searchbox" />
    <div class="search-screen__results" id="search-results" role="list"></div>
  </div>`;
}

/**
 * Initialize search screen — wire up input, debounced search, and card clicks.
 */
export function initSearchScreen(container: HTMLDivElement, props: SearchScreenProps): () => void {
  container.innerHTML = renderSearchScreen(props);

  const input = container.querySelector('#search-input') as HTMLInputElement | null;
  if (!input) return () => {};

  const resultsContainer = container.querySelector('#search-results') as HTMLDivElement | null;
  if (!resultsContainer) return () => {};

  const { fn: debouncedSearch }: { fn: (query: string) => void } = debounce((query: string) => {
    const results = searchVideos(props.videos, query);
    renderResults(results, resultsContainer, props.onVideoSelect);
  }, 300);

  const onInput = (e: Event): void => {
    const query = (e.target as HTMLInputElement).value;
    debouncedSearch(query);
  };
  input.addEventListener('input', onInput);

  // Focus management for D-pad. Bind to the rendered root, not to the container: a
  // screen container is a permanent app-shell node (`#screen-search`), and a loader
  // that re-opens search replaces the container's children without removing listeners
  // bound to the container itself, so every open stacked another handler and one Right
  // arrow moved focus two cards while Enter selected twice (Vizio re-opens on every
  // launch, `platforms/vizio/src/screens/SearchScreen.ts:35`). The root is replaced on
  // each init, so its listener dies with it and cannot stack.
  const screenRoot = container.firstElementChild as HTMLElement | null;
  if (!screenRoot) return () => {};
  const onDpadKeyDown = (e: KeyboardEvent): void => {
    const focused = document.activeElement;
    if (!focused) return;
    const card = focused.closest('[data-video-id]');
    if (!card) return;

    const row = card.parentElement;
    if (!row || !row.classList.contains('search-screen__results')) return;

    const cards = Array.from(row.querySelectorAll('[data-video-id]'));
    const idx = cards.indexOf(card as Element);

    if (e.key === 'ArrowRight' && idx < cards.length - 1) {
      e.preventDefault();
      (cards[idx + 1] as HTMLElement).focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      (cards[idx - 1] as HTMLElement).focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const videoId = card.getAttribute('data-video-id');
      if (videoId) props.onVideoSelect(videoId);
    }
  };
  screenRoot.addEventListener('keydown', onDpadKeyDown);

  input.focus();

  return () => {
    screenRoot.removeEventListener('keydown', onDpadKeyDown);
    input.removeEventListener('input', onInput);
  };
}

function renderResults(
  results: Array<{ video: VideoItem; score: number }>,
  container: HTMLDivElement,
  onVideoSelect: (videoId: string) => void
): void {
  container.innerHTML = '';

  if (results.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'search-screen__no-results';
    noResults.textContent = 'No results found';
    container.appendChild(noResults);
    return;
  }

  for (const result of results) {
    const cardHtml = renderContentCard(result.video as SharedVideoItem);
    const temp = document.createElement('div');
    temp.innerHTML = cardHtml;
    const card = temp.firstElementChild;
    if (!card) continue;
    card.setAttribute('role', 'listitem');
    card.addEventListener('click', () => onVideoSelect(result.video.id));
    container.appendChild(card);
  }
}
