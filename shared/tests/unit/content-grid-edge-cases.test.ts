/**
 * ContentGrid — edge-case tests.
 * Tests empty grids, special categories, and layout edge cases.
 */

import { describe, it, expect } from 'vitest';
import { renderContentGrid, type ContentGridCategory } from '@ctv/shared/ui/ContentGrid';

describe('ContentGrid edge cases', () => {
  it('renders empty grid with no categories', () => {
    const html = renderContentGrid({ categories: [] });
    expect(html).toContain('main-grid');
  });

  it('handles category with special characters', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat-1',
        name: "Today's Picks",
        videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    // Apostrophe is HTML-escaped so it cannot break out of the element.
    expect(html).toContain('Today&#39;s Picks');
    expect(html).not.toContain("Today's Picks");
  });

  it('handles very long category name', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat',
        name: 'A'.repeat(200),
        videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('main-grid');
  });

  it('renders cards with unicode content', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat',
        name: 'Category',
        videos: [
          { id: 'v1', title: '日本語', sdPosterUrl: '/t.jpg' },
          { id: 'v2', title: '🎬 Movie', sdPosterUrl: '/t.jpg' },
        ],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('日本語');
    expect(html).toContain('🎬');
  });

  it('uses cardStyle when provided', () => {
    const cats: ContentGridCategory[] = [
      { id: 'cat', name: 'Cat', videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }] },
    ];
    const html = renderContentGrid({ categories: cats, cardStyle: 'horizontal' });
    expect(html).toContain('main-grid');
  });

  it('handles cards without sdPosterUrl', () => {
    const cats: ContentGridCategory[] = [
      { id: 'cat', name: 'Cat', videos: [{ id: 'v1', title: 'V1' }] as any },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('main-grid');
  });

  it('renders multiple video cards per category', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat',
        name: 'Cat',
        videos: [
          { id: 'v1', title: 'V1', sdPosterUrl: '/t1.jpg' },
          { id: 'v2', title: 'V2', sdPosterUrl: '/t2.jpg' },
          { id: 'v3', title: 'V3', sdPosterUrl: '/t3.jpg' },
        ],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('v1');
    expect(html).toContain('v2');
    expect(html).toContain('v3');
  });
});
