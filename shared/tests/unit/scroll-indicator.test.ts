/**
 * Scroll-position indicator for rails with hidden scrollbars (Samsung UX 1.2).
 *
 * The rails hide their scrollbars, so a marker is the only cue that a row
 * continues. These tests hold two things fixed: the maths (a marker that lies
 * about position is worse than none) and the discretion (no marker on a rail
 * that fits, and no marker before the viewer is inside a rail).
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  INDICATOR_CLASS,
  noteScrollIndicator,
  railPageText,
  railPages,
} from '../../ui/ScrollIndicator';

describe('railPages', () => {
  it('returns null when the rail does not scroll', () => {
    expect(railPages(1000, 1000, 0)).toBeNull();
    expect(railPages(1000, 1000, 900)).toBeNull();
  });

  it('returns null for measurements that cannot be trusted', () => {
    expect(railPages(2500, 0, 0)).toBeNull();
    expect(railPages(Number.NaN, 1000, 0)).toBeNull();
    expect(railPages(2500, 1000, Number.NaN)).toBeNull();
    expect(railPages(2500, 1000, -10)).toBeNull();
  });

  it('counts pages and names the one the focused card sits on', () => {
    expect(railPages(2500, 1000, 0)).toEqual({ pages: 3, page: 1, position: 'start' });
    expect(railPages(2500, 1000, 1200)).toEqual({ pages: 3, page: 2, position: 'middle' });
    expect(railPages(2500, 1000, 2400)).toEqual({ pages: 3, page: 3, position: 'end' });
  });

  it('clamps a card that is further right than the rail is long', () => {
    expect(railPages(2500, 1000, 99_999)).toEqual({ pages: 3, page: 3, position: 'end' });
  });
});

describe('railPageText', () => {
  it('says nothing when there is nothing to say', () => {
    expect(railPageText(null)).toBe('');
    expect(railPageText({ pages: 1, page: 1, position: 'start' })).toBe('');
  });

  it('states the position in words a viewer can act on', () => {
    expect(railPageText({ pages: 3, page: 2, position: 'middle' })).toBe('Page 2 of 3');
  });
});

/** A rail with the dimensions jsdom will not compute for itself. */
function rail({
  scrollWidth,
  clientWidth,
  cardOffset,
}: {
  scrollWidth: number;
  clientWidth: number;
  cardOffset: number;
}): { section: HTMLElement; card: HTMLElement } {
  const section = document.createElement('section');
  section.className = 'content-category';
  const row = document.createElement('div');
  row.className = 'content-category__row';
  const card = document.createElement('div');
  card.className = 'content-card';
  row.appendChild(card);
  section.appendChild(row);
  document.body.appendChild(section);

  Object.defineProperty(row, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(row, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(card, 'offsetParent', { value: row, configurable: true });
  Object.defineProperty(card, 'offsetLeft', { value: cardOffset, configurable: true });
  return { section, card };
}

afterEach(() => {
  // Markers live in the document; leave no residue for the next case.
  document.body.innerHTML = '';
});

function marker(section: HTMLElement): HTMLElement | null {
  return section.querySelector<HTMLElement>(`.${INDICATOR_CLASS}`);
}

describe('noteScrollIndicator', () => {
  it('marks the page of the rail the focus is in', () => {
    const { section, card } = rail({ scrollWidth: 2500, clientWidth: 1000, cardOffset: 1200 });
    noteScrollIndicator(card);

    const shown = marker(section);
    expect(shown).not.toBeNull();
    expect(shown?.textContent).toBe('Page 2 of 3');
    expect(shown?.classList.contains(`${INDICATOR_CLASS}--visible`)).toBe(true);
    expect(shown?.dataset.page).toBe('2');
    expect(shown?.dataset.pages).toBe('3');
    expect(shown?.dataset.position).toBe('middle');
    // A screen reader has to be told, because a visual marker is not one.
    expect(shown?.getAttribute('role')).toBe('status');
    expect(shown?.getAttribute('aria-live')).toBe('polite');
  });

  it('draws nothing for a rail whose cards all fit', () => {
    const { section, card } = rail({ scrollWidth: 1000, clientWidth: 1000, cardOffset: 100 });
    noteScrollIndicator(card);

    const shown = marker(section);
    // Either no marker at all, or one that is not showing: both are "nothing drawn".
    expect(shown === null || !shown.classList.contains(`${INDICATOR_CLASS}--visible`)).toBe(true);
  });

  it('leaves the resting screen alone: no marker until a card takes focus', () => {
    rail({ scrollWidth: 2500, clientWidth: 1000, cardOffset: 0 });
    expect(document.querySelector(`.${INDICATOR_CLASS}`)).toBeNull();
  });

  it('keeps only the rail in focus showing a marker', () => {
    const first = rail({ scrollWidth: 2500, clientWidth: 1000, cardOffset: 0 });
    const second = rail({ scrollWidth: 3000, clientWidth: 1000, cardOffset: 2100 });

    noteScrollIndicator(first.card);
    expect(marker(first.section)?.classList.contains(`${INDICATOR_CLASS}--visible`)).toBe(true);

    noteScrollIndicator(second.card);
    expect(marker(first.section)?.classList.contains(`${INDICATOR_CLASS}--visible`)).toBe(false);
    expect(marker(second.section)?.textContent).toBe('Page 3 of 3');
  });

  it('ignores an element that is not inside a rail', () => {
    const loose = document.createElement('div');
    loose.className = 'content-card';
    document.body.appendChild(loose);
    expect(() => noteScrollIndicator(loose)).not.toThrow();
    expect(document.querySelector(`.${INDICATOR_CLASS}`)).toBeNull();
  });
});
