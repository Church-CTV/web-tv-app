/**
 * WebOS LeftNav UI component — unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createLeftNav,
  updateLeftNav,
  focusActiveItem,
  focusFirstItem,
} from '../../src/ui/LeftNav';

describe('LeftNav', () => {
  let nav: HTMLDivElement;
  let selectedItems: string[];

  const mockItems = [
    { id: 'home', label: 'Home', icon: 'home', screen: 'main' },
    { id: 'search', label: 'Search', icon: 'search', screen: 'search' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'schedule' },
  ];

  beforeEach(() => {
    selectedItems = [];
    nav = createLeftNav({
      items: mockItems,
      onItemClick: (item) => selectedItems.push(item.id),
    });
  });

  it('creates a nav with correct class', () => {
    expect(nav.className).toBe('left-nav');
    expect(nav.getAttribute('aria-label')).toBe('Main navigation');
  });

  it('renders navigation items', () => {
    const items = nav.querySelectorAll('.left-nav__item');
    expect(items).toHaveLength(3);
  });

  it('renders item labels', () => {
    const labels = nav.querySelectorAll('.left-nav__label');
    expect(labels[0]?.textContent).toBe('Home');
    expect(labels[1]?.textContent).toBe('Search');
    expect(labels[2]?.textContent).toBe('Schedule');
  });

  it('attaches click handlers', () => {
    const items = nav.querySelectorAll('.left-nav__item');
    items[0].dispatchEvent(new MouseEvent('click'));
    expect(selectedItems).toContain('home');
  });

  it('sets active state on active item', () => {
    const activeNav = createLeftNav({
      items: mockItems,
      activeItem: 'search',
      onItemClick: (item) => selectedItems.push(item.id),
    });
    const activeItem = activeNav.querySelector('.left-nav__item--active');
    expect(activeItem).toBeTruthy();
    expect(activeItem?.getAttribute('aria-current')).toBe('page');
  });

  it('updates nav with new items', () => {
    const newItems = [{ id: 'settings', label: 'Settings', icon: 'settings', screen: 'settings' }];

    updateLeftNav(nav, {
      items: newItems,
      onItemClick: (item) => selectedItems.push(item.id),
    });

    const items = nav.querySelectorAll('.left-nav__item');
    expect(items).toHaveLength(1);
    expect(items[0]?.querySelector('.left-nav__label')?.textContent).toBe('Settings');
  });

  it('focuses active item', () => {
    const activeNav = createLeftNav({
      items: mockItems,
      activeItem: 'search',
      onItemClick: () => {},
    });
    // Just verify the function doesn't throw
    expect(() => focusActiveItem(activeNav)).not.toThrow();
  });

  it('focuses first item', () => {
    // Just verify the function doesn't throw
    expect(() => focusFirstItem(nav)).not.toThrow();
  });

  it('does nothing if no items exist', () => {
    const emptyNav = createLeftNav({
      items: [],
      onItemClick: () => {},
    });
    expect(() => focusFirstItem(emptyNav)).not.toThrow();
    expect(() => focusActiveItem(emptyNav)).not.toThrow();
  });

  it('routes D-pad keys through the keydown handler without throwing', () => {
    document.body.appendChild(nav);
    // ArrowDown maps to 'down' and invokes routeDpadKey. With no active
    // screen it returns false, but the handler path must still execute.
    const evt = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    expect(() => nav.dispatchEvent(evt)).not.toThrow();
  });

  it('ignores non-arrow keys in the keydown handler', () => {
    document.body.appendChild(nav);
    const evt = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    nav.dispatchEvent(evt);
    // Non-arrow keys return early and do not preventDefault.
    expect(evt.defaultPrevented).toBe(false);
  });

  it('cleanup removes keydown and click handlers', () => {
    document.body.appendChild(nav);
    const before = selectedItems.length;
    (nav as HTMLDivElement & { cleanup: () => void }).cleanup();
    // After cleanup, clicking an item no longer triggers onItemClick.
    const item = nav.querySelector('.left-nav__item');
    if (item) item.dispatchEvent(new MouseEvent('click'));
    expect(selectedItems.length).toBe(before);
  });
});
