/**
 * Vizio Navigation — unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushScreen,
  popScreen,
  getScreenStack,
  canGoBack,
  clearStack,
  initNavigation,
} from '../../../../shared/ui/Navigation';

describe('Vizio Navigation', () => {
  beforeEach(() => {
    clearStack();
    initNavigation();
  });

  it('starts with main screen on stack', () => {
    expect(getScreenStack().length).toBeGreaterThanOrEqual(1);
  });

  it('pushes a screen onto the stack', () => {
    pushScreen('search', () => {});
    expect(getScreenStack()).toContain('search');
  });

  it('pushes multiple screens', () => {
    pushScreen('search', () => {});
    pushScreen('settings', () => {});
    expect(getScreenStack().length).toBeGreaterThanOrEqual(3);
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
    clearStack();
    initNavigation();
    expect(getScreenStack().length).toBeLessThanOrEqual(1);
  });

  it('canGoBack returns false with minimal stack', () => {
    expect(canGoBack()).toBe(false);
  });

  it('canGoBack returns true with multiple screens', () => {
    pushScreen('search', () => {});
    expect(canGoBack()).toBe(true);
  });
});
