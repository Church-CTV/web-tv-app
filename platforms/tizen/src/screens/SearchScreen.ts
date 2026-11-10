/**
 * Tizen search — custom remote keyboard + results grid.
 */

import { searchVideos } from '@ctv/core';
import { SEARCH_PROMPT } from '@ctv/shared/ui/SearchPrompt';
import type { VideoItem } from '@ctv/core';
import { renderContentCard } from '../ui/ContentCard';
import { attachPosterFallbacks } from '../ui/ContentGrid';
import type { SharedVideoItem } from '@ctv/shared/ui/ContentCard';

const ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ['space', 'back', 'clear'],
];

function keyLabel(k: string): string {
  if (k === 'space') return 'Space';
  if (k === 'back')
    return '<svg aria-hidden="true" width="26" height="22" viewBox="0 0 26 22" fill="none"><path d="M10 2H24V20H10L2 11Z M13 7L20 15 M20 7L13 15" stroke="currentColor" stroke-width="2"/></svg>';
  if (k === 'clear') return 'Clear';
  return k.toUpperCase();
}

function renderKeyboard(): string {
  let html = '<div class="osk" id="osk" role="group" aria-label="On-screen keyboard">';
  for (const row of ROWS) {
    html += '<div class="osk-row">';
    for (const k of row) {
      html += `<button type="button" class="osk-key osk-key--${k}" data-key="${k}" ${k === 'back' ? 'aria-label="Delete"' : ''} tabindex="0">${keyLabel(k)}</button>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

export async function loadSearchScreen(
  videos: Array<{
    id: string;
    title: string;
    shortDescription: string;
    hdPosterUrl: string;
    sdPosterUrl: string;
  }>,
  onVideoSelect: (videoId: string, title: string) => void
): Promise<void> {
  const container = document.getElementById('screen-search') as HTMLDivElement | null;
  if (!container) return;

  container.innerHTML = `<div class="search-screen" id="search-screen">
    <h2 class="search-screen__title">Search</h2>
    <div class="search-layout">
      <div class="search-layout__keys">
        <div class="search-query" id="search-query" data-placeholder="Search videos" aria-live="polite"></div>
        <input id="search-input" class="search-input" type="text" hidden aria-hidden="true" aria-label="Search query" />
        ${renderKeyboard()}
      </div>
      <div class="search-screen__results" id="search-results" role="group" aria-label="Search results"></div>
    </div>
  </div>`;

  const queryEl = container.querySelector('#search-query') as HTMLElement;
  const resultsContainer = container.querySelector('#search-results') as HTMLDivElement;
  resultsContainer.innerHTML = SEARCH_PROMPT;
  let query = '';

  const runSearch = (q: string) => {
    queryEl.textContent = q;
    if (!q.trim()) {
      resultsContainer.innerHTML = SEARCH_PROMPT;
      return;
    }
    const results = searchVideos(videos as unknown as VideoItem[], q);
    renderResults(results, resultsContainer, (id) => {
      const video = videos.find((v) => v.id === id);
      if (video) onVideoSelect(video.id, video.title);
    });
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const apply = (next: string) => {
    query = next;
    queryEl.textContent = query;
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(query), 200);
  };

  container.querySelectorAll<HTMLButtonElement>('.osk-key').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.getAttribute('data-key') || '';
      if (k === 'back') apply(query.slice(0, -1));
      else if (k === 'clear') apply('');
      else if (k === 'space') apply(`${query} `);
      else apply(query + k);
    });
  });

  const osk = container.querySelector<HTMLElement>('.osk')!;

  // Navigate logical rows without depending on browser layout measurements.
  // Let outer-edge arrows and Back continue to the app's navigation handler.
  const navigate = (event: KeyboardEvent | CustomEvent<string>) => {
    if (event.defaultPrevented) return;
    const direction = event instanceof KeyboardEvent ? event.key : event.detail;
    const key = (event.target as HTMLElement).closest<HTMLButtonElement>('.osk-key');
    if (!key) return;
    const rows = Array.from(osk.querySelectorAll('.osk-row'));
    const row = key.parentElement!;
    const rowIndex = rows.indexOf(row);
    const keys = Array.from(row.querySelectorAll<HTMLButtonElement>('.osk-key'));
    const column = keys.indexOf(key);
    let next: HTMLButtonElement | undefined;
    if (direction === 'ArrowLeft') next = keys[column - 1];
    else if (direction === 'ArrowRight') next = keys[column + 1];
    else if (direction === 'ArrowUp' || direction === 'ArrowDown') {
      const nextRow = rows[rowIndex + (direction === 'ArrowUp' ? -1 : 1)];
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
  };
  osk.addEventListener('keydown', navigate);
  osk.addEventListener('ctv-dpad', navigate as EventListener);

  osk.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return;
    const key = (event.target as HTMLElement).closest<HTMLButtonElement>('.osk-key');
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    key.click();
  });

  const firstKey = container.querySelector('.osk-key') as HTMLElement | null;
  firstKey?.focus();
}

function renderResults(
  results: Array<{ video: VideoItem; score: number }>,
  container: HTMLDivElement,
  onVideoSelect: (videoId: string) => void
): void {
  container.innerHTML = '';
  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'search-screen__no-results';
    empty.textContent = 'No results found';
    container.appendChild(empty);
    return;
  }
  for (const result of results) {
    const temp = document.createElement('div');
    temp.innerHTML = renderContentCard(result.video as SharedVideoItem);
    const card = temp.firstElementChild as HTMLElement | null;
    if (!card) continue;
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => onVideoSelect(result.video.id));
    container.appendChild(card);
  }
  attachPosterFallbacks(container);
}
