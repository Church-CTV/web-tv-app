/**
 * WEB-047: Bounded rendering for large catalogs.
 *
 * Tests that createCategoryRow renders only a bounded initial set of cards
 * for very large video lists, and provides a loadMore() function to render
 * the remaining cards on demand.
 */
import { describe, test, expect } from 'vitest';
import { createCategoryRow, loadMoreInRow } from '../../src/ui/ContentGrid';

describe('WEB-047: bounded catalog rendering', () => {
  // Create a category with 200 videos (exceeds initial render threshold).
  const largeCategory = {
    id: 'large',
    name: 'Large Category',
    videos: Array.from({ length: 200 }, (_, i) => ({
      videoId: `vid-${i}`,
      title: `Video ${i}`,
      thumbnail: `https://example.com/thumb-${i}.jpg`,
    })),
  };

  test('renders only the first 30 cards initially for a 200-video category', () => {
    const row = createCategoryRow(largeCategory, () => {});
    const cards = row.querySelectorAll('.content-card');

    // Initial render should be bounded.
    expect(cards.length).toBe(30);
    expect(cards.length).toBeLessThan(200);
  });

  test('loadMoreInRow renders the next batch', () => {
    const row = createCategoryRow(largeCategory, () => {});
    const initialCount = row.querySelectorAll('.content-card').length;
    expect(initialCount).toBe(30);

    const loaded = loadMoreInRow(row, 30);
    expect(loaded).toBe(true);

    const afterFirstLoad = row.querySelectorAll('.content-card').length;
    expect(afterFirstLoad).toBe(60);

    const loaded2 = loadMoreInRow(row, 30);
    expect(loaded2).toBe(true);

    const afterSecondLoad = row.querySelectorAll('.content-card').length;
    expect(afterSecondLoad).toBe(90);
  });

  test('loadMoreInRow returns false when all cards are loaded', () => {
    const row = createCategoryRow(largeCategory, () => {});

    // Load all remaining cards (170 more needed).
    while (loadMoreInRow(row, 30)) {
      // keep loading
    }

    const finalCount = row.querySelectorAll('.content-card').length;
    expect(finalCount).toBe(200);

    // Should return false when nothing is left to load.
    const loaded = loadMoreInRow(row, 30);
    expect(loaded).toBe(false);
  });

  test('small categories render all cards immediately', () => {
    const smallCategory = {
      id: 'small',
      name: 'Small Category',
      videos: Array.from({ length: 10 }, (_, i) => ({
        videoId: `vid-${i}`,
        title: `Video ${i}`,
        thumbnail: `https://example.com/thumb-${i}.jpg`,
      })),
    };

    const row = createCategoryRow(smallCategory, () => {});
    const cards = row.querySelectorAll('.content-card');
    expect(cards.length).toBe(10);
  });

  test('cards are keyboard-focusable after lazy load', () => {
    const row = createCategoryRow(largeCategory, () => {});
    document.body.appendChild(row);
    loadMoreInRow(row, 30);

    const cards = row.querySelectorAll('.content-card');
    const lastCard = cards[cards.length - 1] as HTMLElement;
    lastCard.focus();
    expect(document.activeElement).toBe(lastCard);
  });
});
