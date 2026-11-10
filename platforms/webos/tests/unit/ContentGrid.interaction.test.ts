/**
 * WebOS ContentGrid — interaction and D-pad navigation tests.
 *
 * Covers:
 * - D-pad keydown handler (ArrowRight, ArrowDown, ArrowUp, ArrowLeft)
 * - cleanupContentGrid
 * - updateContentGrid keydown handler
 * - scrollRowRight
 * - getRowContainers
 *
 * D-pad contract (K2a):
 * - right: next card in row; wraps to first card at last card
 * - left: bridges to the left-nav item vertically nearest the card
 * - down: same column (clamped) in next row; contained on last row
 * - up: same column (clamped) in previous row; contained on first row
 * All handled keys are absorbed (preventDefault) so the document-level
 * remote fallback never double-handles them.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createContentGrid,
  updateContentGrid,
  cleanupContentGrid,
  focusFirstCard,
  scrollRowRight,
  getRowContainers,
} from '../../src/ui/ContentGrid';

describe('ContentGrid interaction', () => {
  let grid: HTMLDivElement & { cleanup: () => void };
  const mockCategories = [
    {
      id: 'cat1',
      name: 'Category 1',
      videos: [
        { videoId: 'v1', title: 'Video 1', thumbnail: 't1.jpg' },
        { videoId: 'v2', title: 'Video 2', thumbnail: 't2.jpg' },
        { videoId: 'v3', title: 'Video 3', thumbnail: 't3.jpg' },
      ],
    },
    {
      id: 'cat2',
      name: 'Category 2',
      videos: [
        { videoId: 'v4', title: 'Video 4', thumbnail: 't4.jpg' },
        { videoId: 'v5', title: 'Video 5', thumbnail: 't5.jpg' },
      ],
    },
  ];

  beforeEach(() => {
    document.body.innerHTML = '';
    grid = createContentGrid({
      categories: mockCategories,
      onVideoSelect: vi.fn(),
    });
    document.body.appendChild(grid);
  });

  afterEach(() => {
    // Remove the left-nav fixture if a test attached one
    document.querySelector('#left-nav')?.remove();
  });

  /** Attach a left-nav with two items (jsdom rects are zero → nearest = first). */
  function attachLeftNav(): HTMLElement {
    const leftNavContainer = document.createElement('div');
    leftNavContainer.id = 'left-nav';
    const nav = document.createElement('nav');
    nav.className = 'left-nav';
    for (const label of ['Nav 1', 'Nav 2']) {
      const button = document.createElement('button');
      button.className = 'left-nav__item';
      button.setAttribute('aria-label', label);
      button.textContent = label;
      nav.appendChild(button);
    }
    leftNavContainer.appendChild(nav);
    document.body.appendChild(leftNavContainer);
    return nav;
  }

  describe('D-pad navigation', () => {
    function getCards(): HTMLDivElement[] {
      return Array.from(grid.querySelectorAll('.content-card')) as HTMLDivElement[];
    }

    beforeEach(() => {
      // jsdom doesn't implement scrollIntoView — define it on the prototype
      // so both the production call and the spy work.
      (HTMLElement.prototype as never as { scrollIntoView: unknown }).scrollIntoView = () => {};
    });

    it('moves focus right to next card in row', () => {
      const cards = getCards();
      const firstCard = cards[0];
      firstCard.focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      grid.dispatchEvent(keydown);

      expect(document.activeElement).toBe(cards[1]);
    });

    it('wraps focus right from the last card to the first card of the row (K2a)', () => {
      const cards = getCards();
      const lastCardInRow1 = cards[2];
      lastCardInRow1.focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      grid.dispatchEvent(keydown);

      expect(document.activeElement).toBe(cards[0]);
    });

    it('moves focus down to the same column in the next row (K2a)', () => {
      const cards = getCards();
      // Focus the 2nd card of row 1 (index 1) — must land on the 2nd card of row 2
      cards[1].focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      grid.dispatchEvent(keydown);

      expect(document.activeElement).toBe(cards[4]);
    });

    it('clamps down navigation when the next row has fewer cards (K2a)', () => {
      const cards = getCards();
      // Focus the 3rd card of row 1 (index 2); row 2 only has 2 cards
      cards[2].focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      grid.dispatchEvent(keydown);

      expect(document.activeElement).toBe(cards[4]);
    });

    it('moves focus up to the same column in the previous row (K2a)', () => {
      const cards = getCards();
      // Focus the 2nd card of row 2 (index 4) — must land on the 2nd card of row 1
      cards[4].focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      grid.dispatchEvent(keydown);

      expect(document.activeElement).toBe(cards[1]);
    });

    it('contains down focus on the last row (K2a)', () => {
      const cards = getCards();
      const lastRowFirstCard = cards[3];
      lastRowFirstCard.focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      const preventDefaultSpy = vi.spyOn(keydown, 'preventDefault');
      grid.dispatchEvent(keydown);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(lastRowFirstCard);
    });

    it('contains up focus on the first row (K2a)', () => {
      const cards = getCards();
      const firstCard = cards[0];
      firstCard.focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      const preventDefaultSpy = vi.spyOn(keydown, 'preventDefault');
      grid.dispatchEvent(keydown);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(firstCard);
    });

    it('moves focus left to the left-nav (K2a)', () => {
      const nav = attachLeftNav();
      const navItems = nav.querySelectorAll('.left-nav__item');
      const cards = getCards();
      const firstCard = cards[0];
      firstCard.focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      grid.dispatchEvent(keydown);

      // jsdom rects are all zero → nearest item is the first one
      expect((document.activeElement as HTMLElement)?.className).toContain('left-nav__item');
      expect(navItems.length).toBeGreaterThan(0);
    });

    it('ignores keydown when focus is not on a card', () => {
      const nonCard = document.createElement('button');
      nonCard.tabIndex = 0;
      grid.appendChild(nonCard);
      nonCard.focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      const preventDefaultSpy = vi.spyOn(keydown, 'preventDefault');
      grid.dispatchEvent(keydown);

      // Active element is still the non-card button (handler ignored it)
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(nonCard);
    });
  });

  describe('cleanupContentGrid', () => {
    it('calls the grid cleanup function', () => {
      const cleanupSpy = vi.spyOn(grid, 'cleanup');
      cleanupContentGrid(grid);
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('handles grid without cleanup function', () => {
      const plainGrid = document.createElement('div');
      expect(() => cleanupContentGrid(plainGrid)).not.toThrow();
    });
  });

  describe('updateContentGrid', () => {
    it('rebuilds grid with new categories and works with keydown', () => {
      const newCategories = [
        {
          id: 'new-cat',
          name: 'New Category',
          videos: [
            { videoId: 'nv1', title: 'New Video 1', thumbnail: 'nt1.jpg' },
            { videoId: 'nv2', title: 'New Video 2', thumbnail: 'nt2.jpg' },
          ],
        },
      ];

      const updatedGrid = updateContentGrid(grid, newCategories, vi.fn());
      expect(updatedGrid.querySelectorAll('.content-grid__row')).toHaveLength(1);

      const cards = Array.from(updatedGrid.querySelectorAll('.content-card')) as HTMLDivElement[];
      cards[0].focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      updatedGrid.dispatchEvent(keydown);

      expect(document.activeElement).toBe(cards[1]);
    });

    it('wraps right from last card after rebuild (K2a)', () => {
      const newCategories = [
        {
          id: 'new-cat',
          name: 'New Category',
          videos: [
            { videoId: 'nv1', title: 'New Video 1', thumbnail: 'nt1.jpg' },
            { videoId: 'nv2', title: 'New Video 2', thumbnail: 'nt2.jpg' },
          ],
        },
      ];

      const updatedGrid = updateContentGrid(grid, newCategories, vi.fn());
      const cards = Array.from(updatedGrid.querySelectorAll('.content-card')) as HTMLDivElement[];
      cards[1].focus();

      const keydown = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      updatedGrid.dispatchEvent(keydown);

      expect(document.activeElement).toBe(cards[0]);
    });

    it('calls existing cleanup before rebuild', () => {
      const cleanupSpy = vi.fn();
      grid.cleanup = cleanupSpy;

      updateContentGrid(grid, [], vi.fn());

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('scrollRowRight', () => {
    it('scrolls the specified row', () => {
      const row = grid.querySelector('.content-grid__row-videos') as HTMLDivElement;
      row.id = 'test-row';
      // Ensure scrollBy exists (jsdom doesn't implement it) before spying
      (row as unknown as { scrollBy: unknown }).scrollBy = () => {};
      const scrollBySpy = vi.spyOn(row, 'scrollBy');

      scrollRowRight(grid, 'test-row');

      expect(scrollBySpy).toHaveBeenCalledWith({ left: 220, behavior: 'smooth' });
    });

    it('does nothing if row not found', () => {
      expect(() => scrollRowRight(grid, 'nonexistent-row')).not.toThrow();
    });
  });

  describe('getRowContainers', () => {
    it('returns all row containers', () => {
      const rows = getRowContainers(grid);
      expect(rows).toHaveLength(2);
    });

    it('returns empty array for grid with no rows', () => {
      const emptyGrid = createContentGrid({ categories: [], onVideoSelect: vi.fn() });
      const rows = getRowContainers(emptyGrid);
      expect(rows).toHaveLength(0);
    });
  });

  describe('focusFirstCard', () => {
    it('focuses the first card in the grid', () => {
      const cards = Array.from(grid.querySelectorAll('.content-card')) as HTMLDivElement[];
      const focusSpy = vi.spyOn(cards[0], 'focus');

      focusFirstCard(grid);

      expect(focusSpy).toHaveBeenCalled();
    });

    it('does not throw when no cards exist', () => {
      const emptyGrid = createContentGrid({ categories: [], onVideoSelect: vi.fn() });
      expect(() => focusFirstCard(emptyGrid)).not.toThrow();
    });
  });

  describe('cleanup function', () => {
    it('removes card click listeners', () => {
      const cards = Array.from(grid.querySelectorAll('.content-card')) as HTMLDivElement[];
      const removeEventListenerSpy = vi.spyOn(cards[0], 'removeEventListener');

      grid.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});
