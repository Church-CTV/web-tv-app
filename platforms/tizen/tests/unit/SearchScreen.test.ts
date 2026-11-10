/**
 * Tizen SearchScreen — unit tests (aligned with shared/ui API).
 */

import { describe, it, expect } from 'vitest';
import { renderSearchScreen } from '../../src/ui/SearchScreen';
import type { VideoItem } from '@ctv/core';

describe('SearchScreen', () => {
  it('should render search screen with input and results container', () => {
    const html = renderSearchScreen({
      videos: [] as VideoItem[],
      onVideoSelect: () => {},
    });
    expect(html).toContain('search-screen');
    expect(html).toContain('search-input');
    expect(html).toContain('search-results');
    expect(html).toContain('role="searchbox"');
  });

  it('should have correct placeholder text', () => {
    const html = renderSearchScreen({
      videos: [] as VideoItem[],
      onVideoSelect: () => {},
    });
    expect(html).toContain('placeholder="Search videos..."');
  });

  it('should render without errors', () => {
    const html = renderSearchScreen({
      videos: [] as VideoItem[],
      onVideoSelect: () => {},
    });
    expect(html).toContain('search-screen');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});
