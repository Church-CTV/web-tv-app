/**
 * Vizio ScheduleNavIntegration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderLeftNav, type NavItem } from '../../../../shared/ui/LeftNav';

describe('Vizio ScheduleNavIntegration', () => {
  it('renders schedule nav item', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'screen-schedule' },
    ];
    const nav = renderLeftNav({ items, onItemClick: () => {} });
    expect(nav).toContain('Schedule');
  });

  it('renders schedule with all nav items', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'screen-schedule' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
    ];
    const nav = renderLeftNav({ items, onItemClick: () => {} });
    expect(nav).toContain('Home');
    expect(nav).toContain('Schedule');
    expect(nav).toContain('Search');
  });

  it('highlights active schedule item', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'screen-schedule' },
    ];
    const nav = renderLeftNav({ items, activeItem: 'schedule', onItemClick: () => {} });
    expect(nav).toContain('left-nav__item--active');
  });
});
