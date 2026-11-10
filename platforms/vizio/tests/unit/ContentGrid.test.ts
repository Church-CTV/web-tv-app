/**
 * Vizio ContentGrid — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderContentGrid } from '../../../../shared/ui/ContentGrid';
import type { ContentGridCategory } from '../../../../shared/ui/ContentGrid';

describe('Vizio ContentGrid', () => {
  it('renders grid with categories', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat1',
        name: 'Category 1',
        videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('main-grid');
    expect(html).toContain('Category 1');
  });

  it('skips empty categories', () => {
    const cats: ContentGridCategory[] = [{ id: 'empty', name: 'Empty', videos: [] }];
    const html = renderContentGrid({ categories: cats });
    expect(html).not.toContain('Empty');
  });

  it('renders multiple category rows', () => {
    const cats: ContentGridCategory[] = [
      { id: 'cat1', name: 'Animals', videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }] },
      { id: 'cat2', name: 'Nature', videos: [{ id: 'v2', title: 'V2', sdPosterUrl: '/t.jpg' }] },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('Animals');
    expect(html).toContain('Nature');
  });

  it('renders category sections with data attributes', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'my-cat',
        name: 'My Category',
        videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('data-category-id="my-cat"');
  });

  it('renders multiple videos per category', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat1',
        name: 'Cat',
        videos: [
          { id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' },
          { id: 'v2', title: 'V2', sdPosterUrl: '/t.jpg' },
        ],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('V1');
    expect(html).toContain('V2');
  });
});
