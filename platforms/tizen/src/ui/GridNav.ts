/**
 * GridNav — shared spatial D-pad routing between the content grid and the
 * left-nav (K2a).
 *
 * Single source of truth consumed by both input paths so browser/E2E and
 * real-TV (webOSTV.js keysListener) behavior never drift:
 *  - the DOM keydown handlers attached by ContentGrid/LeftNav, and
 *  - the App-level remote-control callbacks.
 *
 * Rules:
 *  - from a grid card:
 *      right → next card, wraps to first in row
 *      left  → the current page's nav item (Home; the grid IS Home's content)
 *      down  → same column (clamped) in next row; contained on last row
 *      up    → same column (clamped) in previous row; contained on first row
 *  - from a left-nav item:
 *      right → vertically nearest card in the grid
 *      up    → previous nav item, contained on first item
 *      down  → next nav item, contained on last item
 *      left  → contained (no zone further left)
 */

/** D-pad direction, shared across all input paths. */
export type DpadDirection = 'up' | 'down' | 'left' | 'right';

import { bestSpatialPick, type Rect, type SpatialDirection } from './SpatialFocus';
import { noteScrollIndicator } from '@ctv/shared/ui/ScrollIndicator';

/**
 * Focus the left-nav item for the CURRENT PAGE (Roku parity: the grid is the
 * Home page's content, so Left from any card raises the Home icon, wherever
 * in the row list the focus line sits). Previously this picked the
 * geometrically nearest icon, which made Left jump to Search/Settings as the
 * focused row drifted below the icon cluster.
 * Falls back to the first item (e.g., jsdom where rects are all zero).
 */
export function focusNavItemNearest(nav: HTMLElement, _card: HTMLElement): void {
  const items = Array.from(nav.querySelectorAll('.left-nav__item')) as HTMLElement[];
  if (items.length === 0) return;
  // Home is the first nav item and the only page with a content grid.
  items[0].focus();
}

/**
 * Focus the grid card whose vertical center is nearest the nav item's.
 * Falls back to the first card (e.g., jsdom where rects are all zero).
 */
export function focusCardNearest(grid: HTMLElement, navItem: HTMLElement): void {
  const cards = Array.from(grid.querySelectorAll('.content-card')) as HTMLElement[];
  if (cards.length === 0) return;

  const itemRect = navItem.getBoundingClientRect();
  const itemY = itemRect.top + itemRect.height / 2;
  let best = cards[0];
  let bestDist = Infinity;
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const d = Math.abs(y - itemY);
    if (d < bestDist) {
      bestDist = d;
      best = card;
    }
  }
  best.focus();
}

/** Scroll the newly focused element into view (off-screen cards, K2a). */
export function scrollToFocused(el: HTMLElement | null | undefined): void {
  el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  // The rail's page marker follows focus, not the scroll animation (UX 1.2).
  noteScrollIndicator(el ?? null);
}

/**
 * Route one D-pad key for the home screen. Must be called with the active
 * element focused inside the grid or left-nav zone.
 *
 * @returns true when the key was consumed (caller should preventDefault).
 */
export function handleGridNavKey(
  grid: HTMLElement,
  nav: HTMLElement | null,
  dir: DpadDirection
): boolean {
  const focused = document.activeElement;
  if (!focused || !(focused instanceof HTMLElement)) return false;

  if (focused.classList.contains('left-nav__item')) {
    return handleNavKey(
      nav ?? (focused.closest('.left-nav') as HTMLElement | null),
      grid,
      focused,
      dir
    );
  }
  return handleGridKey(grid, nav, focused, dir);
}

/** D-pad behavior while focus is on a grid card. */
export function handleGridKey(
  grid: HTMLElement,
  nav: HTMLElement | null,
  currentCard: HTMLElement,
  dir: DpadDirection
): boolean {
  if (!currentCard.classList.contains('content-card')) return false;

  const allRows = Array.from(
    grid.querySelectorAll('.content-grid__row-videos, .content-category__row')
  ) as HTMLDivElement[];
  const currentRow = currentCard.closest(
    '.content-grid__row-videos, .content-category__row'
  ) as HTMLDivElement | null;
  const currentRowIdx = currentRow ? allRows.indexOf(currentRow) : -1;
  if (currentRowIdx === -1 || !currentRow) return false;

  const cardsInRow = Array.from(currentRow.querySelectorAll('.content-card')) as HTMLElement[];
  const colIdx = cardsInRow.indexOf(currentCard);
  if (colIdx === -1) return false;

  switch (dir) {
    case 'right': {
      const nextCard = cardsInRow[(colIdx + 1) % cardsInRow.length];
      nextCard.focus();
      scrollToFocused(nextCard);
      return true;
    }
    case 'left': {
      if (!nav) return true; // containment: no nav zone, absorb the key
      focusNavItemNearest(nav, currentCard);
      return true;
    }
    case 'down': {
      if (currentRowIdx >= allRows.length - 1) return true; // edge containment
      const nextRow = allRows[currentRowIdx + 1];
      const cards = Array.from(nextRow.querySelectorAll('.content-card')) as HTMLElement[];
      const target = cards[Math.min(colIdx, cards.length - 1)];
      target?.focus();
      scrollToFocused(target);
      return true;
    }
    case 'up': {
      if (currentRowIdx <= 0) return true; // edge containment
      const prevRow = allRows[currentRowIdx - 1];
      const cards = Array.from(prevRow.querySelectorAll('.content-card')) as HTMLElement[];
      const target = cards[Math.min(colIdx, cards.length - 1)];
      target?.focus();
      scrollToFocused(target);
      return true;
    }
  }
}

/** D-pad behavior while focus is on a left-nav item. */
function handleNavKey(
  nav: HTMLElement | null,
  grid: HTMLElement,
  current: HTMLElement,
  dir: DpadDirection
): boolean {
  switch (dir) {
    case 'right': {
      focusCardNearest(grid, current);
      return true;
    }
    case 'left':
      return true; // containment: no zone further left
    case 'down': {
      const items = nav
        ? (Array.from(nav.querySelectorAll('.left-nav__item')) as HTMLElement[])
        : [];
      const idx = items.indexOf(current);
      if (idx === -1 || idx >= items.length - 1) return true; // edge containment
      items[idx + 1].focus();
      return true;
    }
    case 'up': {
      const items = nav
        ? (Array.from(nav.querySelectorAll('.left-nav__item')) as HTMLElement[])
        : [];
      const idx = items.indexOf(current);
      if (idx <= 0) return true; // edge containment
      items[idx - 1].focus();
      return true;
    }
  }
}

/**
 * Route one D-pad key for the app, resolving grid + nav from the live DOM.
 * This is the single entry point used by both:
 *  - the DOM keydown handlers (browser / E2E), and
 *  - the App-level webOSTV.js keysListener callbacks (real TV).
 *
 * Only routes through grid nav when the grid screen is actually visible,
 * to prevent focus from leaking into hidden grid/nav zones (K2b).
 *
 * Falls back to the supplied global up/down cycler when the home grid is not
 * on screen (e.g., focus on the overhang or another screen).
 *
 * @returns true when the key was consumed (caller should preventDefault).
 */
export function routeDpadKey(
  dir: DpadDirection,
  focusNext?: () => void,
  focusPrev?: () => void
): boolean {
  // Only use grid routing when the grid screen is active (K2b)
  const gridScreen = document.getElementById('screen-grid');
  const gridActive = gridScreen?.classList.contains('screen-active') ?? false;

  const grid = document.querySelector<HTMLElement>('.content-grid');
  const nav = document.getElementById('left-nav');

  // When the grid is on screen AND active, try GridNav first (handles containment).
  if (gridActive && grid && handleGridNavKey(grid, nav, dir)) return true;

  // Non-home screens (Search, Settings, video, detail, etc.): use TV-style
  // spatial navigation over the visible focusables in the active screen. This
  // is what makes the Search keyboard/results grid and the Settings list fully
  // remote-navigable. If there is no valid spatial target (edge containment or
  // jsdom where rects are zero), fall back to the legacy vertical cycler.
  const spatial = spatialNavActiveScreen(dir);
  if (spatial.handled) return true;

  // Fallback: global vertical cycling (overhang or screens with no focusables).
  if (dir === 'down' && focusNext) {
    focusNext();
    return true;
  }
  if (dir === 'up' && focusPrev) {
    focusPrev();
    return true;
  }
  return false;
}

/**
 * TV-style spatial D-pad fallback for the currently active screen.
 *
 * Used by `routeDpadKey` for every screen that the home grid router does not
 * already own (Search, Settings, video, detail, ...). It treats all
 * focusable elements inside the active screen as a loose 2D layout and moves
 * focus to the nearest element in the pressed direction, with a strong
 * preference for cross-axis alignment (so "right" walks a row, "down" walks a
 * column) and edge containment.
 *
 * Returns `{ handled: true }` when the key was consumed (focus moved, OR the
 * pressed direction is contained at an edge and should be absorbed). Returns
 * `{ handled: false }` when spatial navigation does not apply: no active
 * screen, no origin element, no candidates, or a zero-rect environment such as
 * jsdom (in which case the caller falls back to the legacy cycler).
 */
export function spatialNavActiveScreen(dir: DpadDirection): { handled: boolean } {
  const activeScreen = document.querySelector<HTMLElement>('.screen.screen-active');
  if (!activeScreen) return { handled: false };

  const origin = document.activeElement as HTMLElement | null;
  if (!origin || !(origin instanceof HTMLElement)) return { handled: false };

  const originRect = origin.getBoundingClientRect();
  // jsdom (and any zero-geometry environment) cannot do spatial picking.
  if (originRect.width === 0 && originRect.height === 0) return { handled: false };

  const originIsInScreen = activeScreen.contains(origin);
  const toRect = (r: DOMRect): Rect => ({
    top: r.top,
    left: r.left,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  });
  const focusableSel =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"]), video';
  // Candidates = focusables in the active screen PLUS the persistent left nav
  // (the nav is a sibling of the screens, so it is not matched by
  // activeScreen.querySelectorAll). This makes the nav reachable from every
  // screen (Left from Settings/Search bridges to the sidebar), matching Roku's
  // always-visible LeftNavScreen.
  const seen = new Set<HTMLElement>();
  const all: HTMLElement[] = [];
  const push = (el: HTMLElement) => {
    if (el === origin || seen.has(el)) return;
    seen.add(el);
    all.push(el);
  };
  Array.from(activeScreen.querySelectorAll<HTMLElement>(focusableSel)).forEach(push);
  Array.from(document.querySelectorAll<HTMLElement>('#left-nav .left-nav__item')).forEach(push);

  const isNavItem = (el: HTMLElement) => el.classList.contains('left-nav__item');
  const originIsNavItem = isNavItem(origin);
  // The sidebar is a vertical list: when focus is on a nav item, Up/Down stay
  // within the nav (Roku's LeftNavScreen behavior). Only Right (and the
  // content-side keys) may leave the nav. This keeps the nav a stable spine.
  const navRestricted = originIsNavItem && (dir === 'up' || dir === 'down');

  const candidates = all
    .filter((el) => !navRestricted || isNavItem(el))
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ el, rect: toRect(el.getBoundingClientRect()) }))
    .filter((c) => c.rect.width > 0 && c.rect.height > 0);

  if (candidates.length === 0) {
    // Nothing to move to in this screen or the nav: absorb the key when the
    // origin is inside the active screen OR on a nav item (the nav is a stable
    // spine; leaking to the cycler would yank focus off it).
    return { handled: originIsInScreen || originIsNavItem };
  }

  const from: Rect = toRect(originRect);
  const pick = bestSpatialPick<{ el: HTMLElement; rect: Rect }>(
    from,
    dir as SpatialDirection,
    candidates
  );

  if (!pick) {
    // Contained at an edge: absorb the key so the page does not scroll.
    return { handled: originIsInScreen || originIsNavItem };
  }
  pick.el.focus();
  scrollToFocused(pick.el);
  return { handled: true };
}
