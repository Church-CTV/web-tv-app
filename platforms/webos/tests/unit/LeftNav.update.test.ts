/**
 * LeftNav — unit tests for updateLeftNav and focus helpers.
 * Tests the update and focus functions that complement the existing createLeftNav tests.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createLeftNav,
  updateLeftNav,
  focusActiveItem,
  focusFirstItem,
  type NavItem,
} from '../../src/ui/LeftNav';

const sampleItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', screen: 'screen-home' },
  { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
  { id: 'settings', label: 'Settings', icon: 'settings', screen: 'screen-settings' },
];

describe('LeftNav update', () => {
  it('replaces all items via updateLeftNav', () => {
    const nav = createLeftNav({ items: sampleItems, onItemClick: vi.fn() });
    updateLeftNav(nav, {
      items: [
        { id: 'home', label: 'Home', icon: 'home', screen: 'screen-home' },
        { id: 'live', label: 'Live', icon: 'play', screen: 'screen-live' },
      ],
      onItemClick: vi.fn(),
    });
    const buttons = nav.querySelectorAll('.left-nav__item');
    expect(buttons.length).toBe(2);
  });

  it('updates active item via updateLeftNav', () => {
    const nav = createLeftNav({ items: sampleItems, onItemClick: vi.fn() });
    updateLeftNav(nav, {
      items: sampleItems,
      activeItem: 'search',
      onItemClick: vi.fn(),
    });
    const active = nav.querySelector('.left-nav__item--active');
    expect(active).toBeTruthy();
    expect(active?.getAttribute('data-nav-id')).toBe('search');
  });

  it('maintains correct attributes after update', () => {
    const nav = createLeftNav({ items: sampleItems, onItemClick: vi.fn() });
    updateLeftNav(nav, {
      items: sampleItems,
      onItemClick: vi.fn(),
    });
    const first = nav.querySelector('.left-nav__item');
    expect(first?.getAttribute('aria-label')).toBe('Home');
    expect(first?.getAttribute('data-nav-id')).toBe('home');
  });

  it('clears previous items before adding new ones', () => {
    const nav = createLeftNav({ items: sampleItems, onItemClick: vi.fn() });
    // Replace with empty items
    updateLeftNav(nav, {
      items: [],
      onItemClick: vi.fn(),
    });
    const buttons = nav.querySelectorAll('.left-nav__item');
    expect(buttons.length).toBe(0);
  });

  it('updates with click handler replacement', () => {
    const nav = createLeftNav({ items: sampleItems, onItemClick: vi.fn() });
    const newHandler = vi.fn();
    updateLeftNav(nav, {
      items: sampleItems,
      onItemClick: newHandler,
    });
    const firstItem = nav.querySelector('.left-nav__item') as HTMLElement;
    firstItem.click();
    expect(newHandler).toHaveBeenCalled();
  });
});

describe('LeftNav focus helpers', () => {
  it('focusActiveItem does not throw when active item exists', () => {
    const nav = createLeftNav({
      items: sampleItems,
      activeItem: 'search',
      onItemClick: vi.fn(),
    });
    expect(() => focusActiveItem(nav)).not.toThrow();
  });

  it('focusActiveItem does not throw when no active item exists', () => {
    const nav = createLeftNav({ items: sampleItems, onItemClick: vi.fn() });
    expect(() => focusActiveItem(nav)).not.toThrow();
  });

  it('focusFirstItem does not throw', () => {
    const nav = createLeftNav({ items: sampleItems, onItemClick: vi.fn() });
    expect(() => focusFirstItem(nav)).not.toThrow();
  });

  it('focusFirstItem handles empty nav', () => {
    const emptyNav = createLeftNav({ items: [], onItemClick: vi.fn() });
    expect(() => focusFirstItem(emptyNav)).not.toThrow();
  });

  it('focusFirstItem handles nav with no items', () => {
    const nav = createLeftNav({
      items: sampleItems,
      onItemClick: vi.fn(),
    });
    // Clear manually to test empty state
    nav.innerHTML = '';
    expect(() => focusFirstItem(nav)).not.toThrow();
  });
});
