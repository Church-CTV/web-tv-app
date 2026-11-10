/**
 * WebOS Navigation screen stack — unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pushScreen,
  popScreen,
  getCurrentScreen,
  canGoBack,
  getScreenStack,
  replaceScreen,
  clearStack,
  initNavigation,
} from '../../src/ui/Navigation';

describe('Navigation', () => {
  beforeEach(() => {
    clearStack();
    initNavigation();
  });

  it('starts with main screen', () => {
    expect(getCurrentScreen()).toBe('main');
    expect(getScreenStack()).toEqual(['main']);
  });

  it('pushes a new screen', () => {
    pushScreen('grid', () => {});
    expect(getCurrentScreen()).toBe('grid');
    expect(getScreenStack()).toEqual(['main', 'grid']);
  });

  it('pops current screen', () => {
    pushScreen('grid', () => {});
    pushScreen('video', () => {});
    popScreen();
    expect(getCurrentScreen()).toBe('grid');
    expect(getScreenStack()).toEqual(['main', 'grid']);
  });

  it('does not pop if only one screen', () => {
    pushScreen('grid', () => {});
    popScreen();
    // After popping, we're back to just 'main' (since we only had one screen pushed)
    expect(getCurrentScreen()).toBe('main');
    expect(getScreenStack()).toEqual(['main']);
  });

  it('checks if can go back', () => {
    expect(canGoBack()).toBe(false);
    pushScreen('grid', () => {});
    expect(canGoBack()).toBe(true);
    popScreen();
    expect(canGoBack()).toBe(false);
  });

  it('replaces current screen', () => {
    pushScreen('grid', () => {});
    replaceScreen('video', () => {});
    expect(getCurrentScreen()).toBe('video');
    expect(getScreenStack()).toEqual(['main', 'video']);
  });

  it('clears all screens', () => {
    pushScreen('grid', () => {});
    pushScreen('video', () => {});
    clearStack();
    // After clearing, getScreenStack() returns empty array
    expect(getScreenStack()).toEqual([]);
    // But getCurrentScreen() still returns 'main' as default
    expect(getCurrentScreen()).toBe('main');
  });

  it('calls onEnter callback', () => {
    const onEnter = vi.fn();
    pushScreen('grid', () => {}, onEnter);
    expect(onEnter).toHaveBeenCalled();
  });

  it('restores focus on pop', () => {
    const onFocusRestore = vi.fn();
    pushScreen('grid', () => {}, undefined, onFocusRestore);
    pushScreen('video', () => {});
    popScreen();
    expect(onFocusRestore).toHaveBeenCalled();
  });
});
