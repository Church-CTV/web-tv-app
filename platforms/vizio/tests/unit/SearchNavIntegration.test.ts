/**
 * Vizio SearchNavIntegration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderLeftNav, type NavItem } from '../../../../shared/ui/LeftNav';

describe('Vizio SearchNavIntegration', () => {
  it('renders search nav item', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'screen-schedule' },
    ];
    const nav = renderLeftNav({ items, onItemClick: () => {} });
    expect(nav).toContain('search');
    expect(nav).toContain('Search');
  });

  it('renders multiple nav items', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
    ];
    const nav = renderLeftNav({ items, onItemClick: () => {} });
    expect(nav).toContain('Home');
    expect(nav).toContain('Search');
  });

  it('highlights active search item', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
    ];
    const nav = renderLeftNav({ items, activeItem: 'search', onItemClick: () => {} });
    expect(nav).toContain('left-nav__item--active');
  });
});
