/**
 * Tizen Navigation — unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushScreen,
  popScreen,
  getScreenStack,
  getCurrentScreen,
  canGoBack,
  clearStack,
  initNavigation,
} from '../../../../shared/ui/Navigation';

describe('Tizen Navigation', () => {
  beforeEach(() => {
    clearStack();
    initNavigation();
  });

  it('starts with main screen on stack', () => {
    expect(getScreenStack()).toContain('main');
    expect(getScreenStack().length).toBeGreaterThanOrEqual(1);
  });

  it('pushes a screen onto the stack', () => {
    pushScreen('search', () => {});
    expect(getScreenStack()).toContain('search');
  });

  it('pushes multiple screens', () => {
    pushScreen('search', () => {});
    pushScreen('settings', () => {});
    expect(getScreenStack()).toContain('search');
    expect(getScreenStack()).toContain('settings');
  });

  it('pops the top screen', () => {
    pushScreen('search', () => {});
    popScreen();
    expect(getScreenStack().length).toBeLessThanOrEqual(2);
  });

  it('pops empty stack gracefully', () => {
    expect(() => popScreen()).not.toThrow();
  });

  it('clears all screens', () => {
    pushScreen('search', () => {});
    pushScreen('settings', () => {});
    clearStack();
    initNavigation();
    expect(getScreenStack().length).toBeLessThanOrEqual(1);
  });

  it('getCurrentScreen returns top of stack', () => {
    pushScreen('search', () => {});
    expect(getCurrentScreen()).toBe('search');
  });

  it('canGoBack returns false with one screen', () => {
    expect(canGoBack()).toBe(false);
  });

  it('canGoBack returns true with multiple screens', () => {
    pushScreen('search', () => {});
    expect(canGoBack()).toBe(true);
  });

  it('pushes with custom render function', () => {
    let rendered = false;
    pushScreen('video', () => {
      rendered = true;
    });
    expect(rendered).toBe(true);
  });

  it('pushes with onEnter callback', () => {
    let entered = false;
    pushScreen(
      'video',
      () => {},
      () => {
        entered = true;
      }
    );
    expect(entered).toBe(true);
  });
});
