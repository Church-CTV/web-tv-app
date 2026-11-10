import { describe, it, expect } from 'vitest';
import { renderLeftNav } from '../../src/ui/LeftNav';

describe('LeftNav', () => {
  it('should render navigation items', () => {
    const items = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'search' },
      { id: 'settings', label: 'Settings', icon: 'settings', screen: 'settings' },
    ];

    const html = renderLeftNav({ items, onItemClick: () => {} });

    expect(html).toContain('left-nav');
    expect(html).toContain('Home');
    expect(html).toContain('Search');
    expect(html).toContain('Settings');
  });

  it('should mark active item', () => {
    const items = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'search' },
    ];

    const html = renderLeftNav({ items, activeItem: 'search', onItemClick: () => {} });

    expect(html).toContain('left-nav__item--active');
    expect(html).toContain('aria-current="page"');
  });

  it('should render icons with correct classes', () => {
    const items = [{ id: 'home', label: 'Home', icon: 'home', screen: 'grid' }];

    const html = renderLeftNav({ items, onItemClick: () => {} });

    expect(html).toContain('left-nav__icon--home');
    expect(html).toContain('left-nav__icon');
  });

  it('should escape HTML in labels', () => {
    const items = [
      { id: 'home', label: '<script>alert("xss")</script>', icon: 'home', screen: 'grid' },
    ];

    const html = renderLeftNav({ items, onItemClick: () => {} });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
