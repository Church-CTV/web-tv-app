import { describe, it, expect } from 'vitest';
import { renderSearchScreen } from '../../src/ui/SearchScreen';

describe('SearchScreen', () => {
  it('should render search screen with input and results container', () => {
    const props = {
      videos: [{ id: 'v1', title: 'Video 1', thumbnail: '/v1.jpg' }],
      onVideoSelect: () => {},
    };

    const html = renderSearchScreen(props);

    expect(html).toContain('search-screen');
    expect(html).toContain('search-input');
    expect(html).toContain('search-results');
    expect(html).toContain('role="searchbox"');
  });

  it('should have correct placeholder text', () => {
    const props = {
      videos: [],
      onVideoSelect: () => {},
    };

    const html = renderSearchScreen(props);

    expect(html).toContain('placeholder="Search videos..."');
  });

  it('should render without errors', () => {
    const props = {
      videos: [],
      onVideoSelect: () => {},
    };

    const html = renderSearchScreen(props);

    expect(html).toContain('search-screen');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});
