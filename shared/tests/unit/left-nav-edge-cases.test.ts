/**
 * LeftNav — edge-case tests.
 * Tests navigation rendering, XSS, and layout variants.
 */

import { describe, it, expect } from 'vitest';
import { renderLeftNav, type NavItem } from '@ctv/shared/ui/LeftNav';

describe('LeftNav edge cases', () => {
  const baseItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: 'home', screen: 'grid' },
    { id: 'search', label: 'Search', icon: 'search', screen: 'search' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'schedule' },
    { id: 'continue', label: 'Continue Watching', icon: 'play', screen: 'continue' },
    { id: 'settings', label: 'Settings', icon: 'settings', screen: 'settings' },
  ];

  it('renders single item', () => {
    const html = renderLeftNav({ items: [baseItems[0]], onItemClick: () => {} });
    expect(html).toContain('Home');
    expect(html).toContain('left-nav');
  });

  it('renders many items', () => {
    const items: NavItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `nav-${i}`,
      label: `Item ${i}`,
      icon: 'default',
      screen: `screen-${i}`,
    }));
    const html = renderLeftNav({ items, onItemClick: () => {} });
    expect(html).toContain('left-nav');
    expect(html).toContain('Item 19');
  });

  it('renders custom icon HTML', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: '<svg>icon</svg>', screen: 'grid' },
    ];
    const html = renderLeftNav({ items, onItemClick: () => {} });
    expect(html).toContain('icon');
  });

  it('highlights active item only', () => {
    const html = renderLeftNav({
      items: baseItems,
      activeItem: 'schedule',
      onItemClick: () => {},
    });
    expect(html).toContain('left-nav__item--active');
    // Only one item should be active
    const activeCount = (html.match(/left-nav__item--active/g) || []).length;
    expect(activeCount).toBe(1);
  });

  it('no active item when not specified', () => {
    const html = renderLeftNav({ items: baseItems, onItemClick: () => {} });
    expect(html).not.toContain('left-nav__item--active');
  });

  it('handles empty item list', () => {
    const html = renderLeftNav({ items: [], onItemClick: () => {} });
    expect(html).toContain('left-nav');
  });

  it('escapes XSS in label via attribute', () => {
    const items: NavItem[] = [
      { id: 'xss', label: '" onclick="alert(1)', icon: 'home', screen: 'grid' },
    ];
    const html = renderLeftNav({ items, onItemClick: () => {} });
    expect(html).not.toContain('" onclick="alert(1)"');
    expect(html).toContain('&quot;');
  });

  it('renders screen attribute on items', () => {
    const html = renderLeftNav({ items: baseItems, onItemClick: () => {} });
    expect(html).toContain('screen="grid"');
    expect(html).toContain('screen="schedule"');
  });
});
