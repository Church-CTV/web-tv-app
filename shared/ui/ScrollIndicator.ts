/**
 * Scroll-position indicator for rails whose scrollbars are hidden.
 *
 * Samsung UX 1.2 asks for a scroll or position indicator when content does not
 * fit on screen. The rails in this app hide their scrollbars deliberately
 * (`scrollbar-width: none`) because a grey bar is useless on a television, which
 * leaves the viewer with no cue that a row continues past the right edge. This
 * module supplies that cue: a page marker ("Page 2 of 5") where the scrollbar
 * would have been.
 *
 * Two design decisions worth their reasons:
 *
 * - It is computed from the **focused card**, not from a scroll event. The rails
 *   scroll with `behavior: 'smooth'`, so when the key handler runs the scroll
 *   position is still an animation target; measuring the card gives the answer
 *   immediately and matches what the viewer is about to see.
 * - It is **not rendered on load**. The marker appears when a viewer is actually
 *   inside a rail, so the resting screen keeps its artwork without a control
 *   hovering over it - and the pinned screenshots keep showing what a viewer
 *   sees before pressing anything.
 */

export interface RailPages {
  /** How many screens of cards the rail holds. */
  pages: number;
  /** 1-based page containing the card that has focus. */
  page: number;
  /** Where that page sits in the rail, for wording and styling. */
  position: 'start' | 'middle' | 'end';
}

/** Selector for the scrolling element of a rail, shared by the grid layouts. */
export const RAIL_SELECTOR = '.content-category__row, .content-grid__row-videos';
/** Selector for the element that carries the marker (a rail's own section). */
export const RAIL_HOST_SELECTOR = '.content-category, .content-grid__row';

/** Class of the marker element: the stylesheet and the tests use this one name. */
export const INDICATOR_CLASS = 'content-row__indicator';
const VISIBLE_CLASS = 'content-row__indicator--visible';

/**
 * Which page of a rail a card offset falls on.
 *
 * @param scrollWidth - the rail's full scrollable width, in px
 * @param clientWidth - the rail's visible width, in px
 * @param offsetLeft - the focused card's left edge inside the rail, in px
 * @returns the page state, or `null` when the rail does not scroll, or the
 *   measurements are unusable. A rail that has not been laid out yet (zero
 *   width) is deliberately `null`: "Page 1 of 1" would be a cue that means
 *   nothing, and a cue that means nothing trains the viewer to ignore cues.
 */
export function railPages(
  scrollWidth: number,
  clientWidth: number,
  offsetLeft: number
): RailPages | null {
  if (![scrollWidth, clientWidth, offsetLeft].every((v) => Number.isFinite(v) && v >= 0))
    return null;
  if (clientWidth <= 0) return null;
  // One pixel of tolerance: sub-pixel layout makes scrollWidth exceed
  // clientWidth on rails that do fit, and "Page 1 of 2" for a row with nothing
  // hidden is a worse indicator than none.
  if (scrollWidth <= clientWidth + 1) return null;

  const pages = Math.max(1, Math.ceil(scrollWidth / clientWidth));
  const page = Math.min(pages, Math.max(1, Math.floor(offsetLeft / clientWidth) + 1));
  const position = page === 1 ? 'start' : page === pages ? 'end' : 'middle';
  return { pages, page, position };
}

/** The words the marker shows; empty when there is nothing worth saying. */
export function railPageText(pages: RailPages | null): string {
  if (!pages || pages.pages <= 1) return '';
  return `Page ${pages.page} of ${pages.pages}`;
}

/**
 * Update (or create) the marker for the rail that contains `card`, and quiet
 * every other rail's marker so the screen never shows two readouts.
 *
 * @param card - the element that just took focus, usually a content card
 */
export function noteScrollIndicator(card: Element | null | undefined): void {
  if (!card || !card.isConnected) return;
  const rail = card.closest(RAIL_SELECTOR);
  if (!(rail instanceof HTMLElement)) return;

  const pages = railPages(rail.scrollWidth, rail.clientWidth, cardOffsetInRail(card, rail));
  const text = railPageText(pages);
  const host = (rail.closest(RAIL_HOST_SELECTOR) as HTMLElement | null) ?? rail;

  for (const other of document.querySelectorAll<HTMLElement>(`.${INDICATOR_CLASS}`)) {
    if (other !== host || !text) other.classList.remove(VISIBLE_CLASS);
  }
  if (!text) return;

  let marker = host.querySelector<HTMLElement>(`:scope > .${INDICATOR_CLASS}`);
  if (!marker) {
    marker = document.createElement('div');
    marker.className = INDICATOR_CLASS;
    marker.setAttribute('role', 'status');
    marker.setAttribute('aria-live', 'polite');
    host.appendChild(marker);
  }
  const state = pages as RailPages;
  marker.textContent = text;
  marker.dataset.page = String(state.page);
  marker.dataset.pages = String(state.pages);
  marker.dataset.position = state.position;
  marker.classList.add(VISIBLE_CLASS);
}

/** Left edge of the card inside the rail's own scroll coordinates. */
function cardOffsetInRail(card: Element, rail: HTMLElement): number {
  if (!(card instanceof HTMLElement)) return rail.scrollLeft;
  if (card.offsetParent === rail) return card.offsetLeft;
  const delta = card.getBoundingClientRect().left - rail.getBoundingClientRect().left;
  return Math.max(0, delta + rail.scrollLeft);
}
