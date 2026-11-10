/**
 * ContentGrid — Full content grid with category rows.
 * Mirrors Roku's RowList component with horizontal scrolling per row
 * and D-pad keyboard navigation between rows and within rows.
 *
 * D-pad behavior lives in GridNav.ts (shared with the TV remote-control
 * path) so both inputs behave identically (K2a).
 */

import { createContentCard, ContentCardProps } from './ContentCard';
import { handleGridNavKey } from './GridNav';

export interface Category {
  id: string;
  name: string;
  videos: ContentCardProps[];
}

export interface ContentGridProps {
  categories: Category[];
  onVideoSelect: (videoId: string) => void;
  onBack?: () => void;
}

// Track card click handlers for cleanup.
// Uses a regular Map (not WeakMap) because we need forEach/clear for cleanup.
const cardClickHandlers = new Map<HTMLElement, () => void>();

/**
 * Create the grid's DOM keydown handler (browser / E2E path).
 * Delegates to GridNav so behavior matches the TV path exactly.
 */
function createGridKeydownHandler(grid: HTMLElement): (evt: Event) => void {
  const dirMap: Record<string, Parameters<typeof handleGridNavKey>[2]> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };
  return (evt: Event) => {
    const e = evt as KeyboardEvent;
    const dir = dirMap[e.key];
    if (!dir) return;
    const nav = document.querySelector<HTMLElement>('#left-nav .left-nav');
    if (handleGridNavKey(grid, nav, dir)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
}

/**
 * Create a ContentGrid component with optimized rendering.
 * Uses DocumentFragment to batch card DOM operations and minimize reflows.
 */
/** Number of cards to render initially per row. Remaining cards lazy-load. */
const INITIAL_RENDER_COUNT = 30;

export function loadMoreInRow(row: HTMLDivElement, count = 30): boolean {
  const remainingEl = row.querySelector('[data-webos-grid-remaining]') as HTMLElement | null;
  if (!remainingEl) return false;

  const remaining = JSON.parse(remainingEl.getAttribute('data-webos-grid-remaining') || '[]');
  if (remaining.length === 0) {
    remainingEl.remove();
    return false;
  }

  const videosContainer = row.querySelector('.content-grid__row-videos') as HTMLDivElement;
  if (!videosContainer) return false;

  const toRender = remaining.splice(0, count);
  const fragment = document.createDocumentFragment();
  for (const video of toRender) {
    const card = createContentCard({
      videoId: video.videoId,
      title: video.title,
      thumbnail: video.thumbnail,
      progress: video.progress,
      isActive: false,
    });
    card.setAttribute('role', 'listitem');
    card.addEventListener('click', () => {
      const handler = row.getAttribute('data-webos-grid-on-select');
      if (handler) {
        // Trigger a custom event that the grid listens for
        const evt = new CustomEvent('webos-grid-select', { detail: video.videoId });
        row.dispatchEvent(evt);
      }
    });
    fragment.appendChild(card);
  }
  videosContainer.appendChild(fragment);

  if (remaining.length > 0) {
    remainingEl.setAttribute('data-webos-grid-remaining', JSON.stringify(remaining));
  } else {
    remainingEl.remove();
  }
  return true;
}

export function createContentGrid(
  props: ContentGridProps
): HTMLDivElement & { cleanup: () => void } {
  const grid = document.createElement('div');
  grid.className = 'content-grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Videos');

  // Render each category as a row
  for (const category of props.categories) {
    const row = createCategoryRow(category, props.onVideoSelect);
    grid.appendChild(row);
  }

  const gridKeydownHandler = createGridKeydownHandler(grid);
  grid.addEventListener('keydown', gridKeydownHandler);

  // Cleanup function
  const cleanup = () => {
    grid.removeEventListener('keydown', gridKeydownHandler);
    cardClickHandlers.forEach((handler, card) => {
      card.removeEventListener('click', handler);
    });
    cardClickHandlers.clear();
  };

  return Object.assign(grid, { cleanup }) as HTMLDivElement & { cleanup: () => void };
}

/**
 * Create a single category row with optimized rendering.
 * Uses DocumentFragment to batch card DOM operations.
 */
export function createCategoryRow(
  category: Category,
  onVideoSelect: (videoId: string) => void
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'content-grid__row';

  // Category title
  const title = document.createElement('h2');
  title.className = 'content-grid__row-title';
  title.textContent = category.name;
  row.appendChild(title);

  // Videos container
  const videosContainer = document.createElement('div');
  videosContainer.className = 'content-grid__row-videos';
  videosContainer.setAttribute('role', 'list');

  // Bounded rendering: render first INITIAL_RENDER_COUNT cards,
  // store the rest for lazy loading via loadMoreInRow().
  const allVideos = category.videos;
  let toRender: typeof allVideos;
  let remaining: typeof allVideos = [];

  if (allVideos.length > INITIAL_RENDER_COUNT) {
    toRender = allVideos.slice(0, INITIAL_RENDER_COUNT);
    remaining = allVideos.slice(INITIAL_RENDER_COUNT);
  } else {
    toRender = allVideos;
  }

  // Use DocumentFragment to batch card DOM operations and minimize reflows
  const fragment = document.createDocumentFragment();
  for (const video of toRender) {
    const card = createContentCard({
      ...video,
      isActive: false,
    });
    card.setAttribute('role', 'listitem');
    const handler = () => onVideoSelect(video.videoId);
    card.addEventListener('click', handler);
    cardClickHandlers.set(card, handler);
    fragment.appendChild(card);
  }
  videosContainer.appendChild(fragment);

  // Store remaining videos for lazy loading
  if (remaining.length > 0) {
    const remainingEl = document.createElement('div');
    remainingEl.className = 'webos-grid-remaining';
    remainingEl.setAttribute('data-webos-grid-remaining', JSON.stringify(remaining));
    row.appendChild(remainingEl);
  }

  row.appendChild(videosContainer);
  return row;
}

/**
 * Remove all event listeners from a ContentGrid.
 * Call this before destroying or replacing the grid.
 */
export function cleanupContentGrid(grid: HTMLDivElement): void {
  const gridWithCleanup = grid as HTMLDivElement & { cleanup?: () => void };
  if (gridWithCleanup.cleanup) {
    gridWithCleanup.cleanup();
  }
}

/**
 * Update the ContentGrid with new data.
 * Cleans up existing event listeners before rebuilding.
 */
export function updateContentGrid(
  grid: HTMLDivElement,
  categories: Category[],
  onVideoSelect: (videoId: string) => void
): HTMLDivElement & { cleanup: () => void } {
  // Call existing cleanup if available
  const gridWithCleanup = grid as HTMLDivElement & { cleanup?: () => void };
  if (gridWithCleanup.cleanup) {
    gridWithCleanup.cleanup();
  }

  grid.innerHTML = '';

  // Re-render all categories
  for (const category of categories) {
    const row = createCategoryRow(category, onVideoSelect);
    grid.appendChild(row);
  }

  const gridKeydownHandler = createGridKeydownHandler(grid);
  grid.addEventListener('keydown', gridKeydownHandler);

  const cleanup = () => {
    grid.removeEventListener('keydown', gridKeydownHandler);
    cardClickHandlers.forEach((handler, card) => {
      card.removeEventListener('click', handler);
    });
    cardClickHandlers.clear();
  };

  return Object.assign(grid, { cleanup }) as HTMLDivElement & { cleanup: () => void };
}

/**
 * Focus the first video card in the grid.
 */
export function focusFirstCard(grid: HTMLDivElement): void {
  const firstCard = grid.querySelector('.content-card') as HTMLElement;
  if (firstCard) {
    firstCard.focus();
  }
}

/**
 * Scroll a specific row to the right by one card width.
 */
export function scrollRowRight(grid: HTMLDivElement, rowId: string): void {
  const row = grid.querySelector(`#${rowId}`) as HTMLDivElement | null;
  if (row) {
    row.scrollBy({ left: 220, behavior: 'smooth' });
  }
}

/**
 * Get all row containers for D-pad navigation.
 */
export function getRowContainers(grid: HTMLDivElement): HTMLDivElement[] {
  return Array.from(grid.querySelectorAll('.content-grid__row-videos')) as HTMLDivElement[];
}
