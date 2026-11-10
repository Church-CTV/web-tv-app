/**
 * Tizen Search Nav Integration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderSearchScreen } from '../../src/ui/SearchScreen';

describe('Tizen Search Nav Integration', () => {
  it('renders search screen HTML', () => {
    const html = renderSearchScreen({
      videos: [{ id: 'v1', title: 'Video 1' } as any, { id: 'v2', title: 'Video 2' } as any],
      onVideoSelect: () => {},
    });
    expect(html).toContain('search-screen');
    expect(html).toContain('Search videos');
  });

  it('renders search input', () => {
    const html = renderSearchScreen({
      videos: [],
      onVideoSelect: () => {},
    });
    expect(html).toContain('search-input');
    expect(html).toContain('search-results');
  });

  it('renders without errors for empty videos', () => {
    const html = renderSearchScreen({
      videos: [],
      onVideoSelect: () => {},
    });
    expect(html).toContain('search-screen');
  });

  it('renders search screen for multiple videos', () => {
    const html = renderSearchScreen({
      videos: [
        { id: 'v1', title: 'Video 1' } as any,
        { id: 'v2', title: 'Video 2' } as any,
        { id: 'v3', title: 'Video 3' } as any,
      ],
      onVideoSelect: () => {},
    });
    expect(html).toContain('Search videos');
  });
});
