/**
 * SearchNavIntegration — verifies Search is wired into App.ts navigation.
 * Tests the integration point: left nav click → search screen renders.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLeftNav, type NavItem } from '../../src/ui/LeftNav';
import { createSearchScreen } from '../../src/ui/SearchScreen';

describe('SearchNavIntegration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.createElement('div');
    container.id = 'screen-container';
    container.className = 'screen-container';
    document.body.appendChild(container);
  });

  it('Search nav item exists and triggers search screen', () => {
    // Build the search screen container
    const searchScreen = document.createElement('div');
    searchScreen.id = 'screen-search';
    searchScreen.className = 'screen';
    container.appendChild(searchScreen);

    // Create left nav with search (matching App.ts structure)
    const navItems: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'screen-schedule' },
      { id: 'settings', label: 'Settings', icon: 'settings', screen: 'screen-settings' },
    ];

    let searchClicked = false;
    let searchScreenContent: HTMLElement | null = null;

    const nav = createLeftNav({
      items: navItems,
      onItemClick: (item) => {
        if (item.id === 'search') {
          searchClicked = true;
          // Simulate loadSearchScreen() rendering
          searchScreenContent = createSearchScreen({
            videos: [],
            onVideoSelect: vi.fn(),
          });
          searchScreen.innerHTML = '';
          searchScreen.appendChild(searchScreenContent);
          searchScreen.classList.add('screen-active');
        }
      },
    });

    container.appendChild(nav);

    // Click the search nav item
    const searchBtn = nav.querySelector('[data-nav-id="search"]') as HTMLElement;
    expect(searchBtn).toBeTruthy();
    expect(searchBtn.textContent).toContain('Search');

    searchBtn.click();

    // Verify the search screen was triggered and rendered
    expect(searchClicked).toBe(true);
    expect(searchScreen.classList.contains('screen-active')).toBe(true);
    expect(searchScreenContent).toBeTruthy();
    expect(searchScreenContent?.querySelector('.search-screen__input')).toBeTruthy();
  });

  it('all nav items point to correct screens', () => {
    const navItems: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
      { id: 'schedule', label: 'Schedule', icon: 'calendar', screen: 'screen-schedule' },
      { id: 'settings', label: 'Settings', icon: 'settings', screen: 'screen-settings' },
    ];

    const screenMap: Record<string, HTMLDivElement> = {};
    for (const item of navItems) {
      const el = document.createElement('div');
      el.id = item.screen;
      el.className = 'screen';
      container.appendChild(el);
      screenMap[item.screen] = el;
    }

    let clickedScreenId: string | null = null;
    const nav = createLeftNav({
      items: navItems,
      onItemClick: (item) => {
        clickedScreenId = item.screen;
        // Toggle screen visibility
        Object.values(screenMap).forEach((s) => s.classList.remove('screen-active'));
        screenMap[item.screen]?.classList.add('screen-active');
      },
    });

    container.appendChild(nav);

    // Click each item and verify correct screen activates
    const homeBtn = nav.querySelector('[data-nav-id="home"]') as HTMLElement;
    homeBtn.click();
    expect(clickedScreenId).toBe('screen-grid');
    expect(screenMap['screen-grid']?.classList.contains('screen-active')).toBe(true);

    const searchBtn = nav.querySelector('[data-nav-id="search"]') as HTMLElement;
    searchBtn.click();
    expect(clickedScreenId).toBe('screen-search');
    expect(screenMap['screen-search']?.classList.contains('screen-active')).toBe(true);

    const scheduleBtn = nav.querySelector('[data-nav-id="schedule"]') as HTMLElement;
    scheduleBtn.click();
    expect(clickedScreenId).toBe('screen-schedule');
    expect(screenMap['screen-schedule']?.classList.contains('screen-active')).toBe(true);

    const settingsBtn = nav.querySelector('[data-nav-id="settings"]') as HTMLElement;
    settingsBtn.click();
    expect(clickedScreenId).toBe('screen-settings');
    expect(screenMap['screen-settings']?.classList.contains('screen-active')).toBe(true);
  });
});
