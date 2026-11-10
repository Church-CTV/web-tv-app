/**
 * WebOS Platform — Adapter unit tests.
 * Tests the adapter layer logic (focus management, video player, error handling).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFocusManager, applyFocusStyle } from '../../src/utils/FocusManager';
import {
  getErrorScreen,
  renderErrorScreen,
  initErrorScreen,
  withErrorBoundary,
  handleVideoError,
  handleFeedError,
} from '../../src/utils/ErrorHandling';

// ─── FocusManager Tests ────────────────────────────────────────────────────────

describe('FocusManager', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <a href="#" class="item-1">Link 1</a>
      <button class="item-2">Button 2</button>
      <div tabindex="0" class="item-3">Div 3</div>
      <input type="text" class="item-4" />
      <button disabled class="item-5">Disabled</button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('focuses first element', () => {
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.className).toBe('item-1');
  });
  it('focuses next element in sequence', () => {
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.className).toBe('item-1');
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-2');
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-3');
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-4');
  });

  it('wraps focus from last to first', () => {
    const fm = createFocusManager(container);
    const items = container.querySelectorAll('.item-1, .item-2, .item-3, .item-4');
    // Skip disabled button
    expect(items).toHaveLength(4);
    // Focus last input, then next should wrap to first
    (items[3] as HTMLElement).focus();
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-1');
  });

  it('skips disabled buttons', () => {
    const fm = createFocusManager(container);
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
    );
    // item-5 is disabled, should not be in focusable list
    expect(focusable).toHaveLength(4);
  });

  it('reports current focus correctly', () => {
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(fm.getCurrentFocus()?.className).toBe('item-1');
  });

  it('checks if element has focus', () => {
    const fm = createFocusManager(container);
    const first = container.querySelector('.item-1') as HTMLElement;
    fm.focusFirst();
    expect(fm.hasFocus(first)).toBe(true);
  });
});

// ─── ErrorHandling Tests ──────────────────────────────────────────────────────

describe('ErrorHandling', () => {
  describe('getErrorScreen', () => {
    it('returns correct data for network error', () => {
      const error = getErrorScreen('network');
      expect(error.type).toBe('network');
      expect(error.title).toBe('Connection Error');
      expect(error.retryable).toBe(true);
    });

    it('returns correct data for video error', () => {
      const error = getErrorScreen('video');
      expect(error.type).toBe('video');
      expect(error.title).toBe('Playback Error');
    });

    it('returns generic error for unknown type', () => {
      const error = getErrorScreen('generic');
      expect(error.type).toBe('generic');
    });
  });

  describe('renderErrorScreen', () => {
    it('renders error screen HTML', () => {
      const error = getErrorScreen('network');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Connection Error');
      expect(html).toContain('Unable to connect');
      expect(html).toContain('Try Again');
    });

    it('includes error details when provided', () => {
      const error = getErrorScreen('feed');
      error.details = 'Invalid JSON: unexpected token';
      const html = renderErrorScreen(error);
      expect(html).toContain('Invalid JSON');
    });

    it('omits retry button when not retryable', () => {
      const error = getErrorScreen('generic');
      error.retryable = false;
      const html = renderErrorScreen(error);
      expect(html).not.toContain('Try Again');
    });
  });

  describe('withErrorBoundary', () => {
    it('executes function normally', () => {
      const fn = withErrorBoundary(
        () => 42,
        () => {}
      );
      expect(fn()).toBe(42);
    });

    it('calls onError on error', () => {
      const onError = vi.fn();
      const fn = withErrorBoundary(() => {
        throw new Error('test');
      }, onError);
      fn();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe('test');
    });

    it('returns undefined on error', () => {
      const onError = vi.fn();
      const fn = withErrorBoundary(() => {
        throw new Error('test');
      }, onError);
      const result = fn();
      expect(result).toBeUndefined();
    });
  });

  describe('handleVideoError', () => {
    it('reports error when player state is error', () => {
      const onError = vi.fn();
      const mockPlayer = { getState: () => 'error' } as any;
      handleVideoError(mockPlayer, onError);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].type).toBe('video');
    });

    it('does not report when player is playing', () => {
      const onError = vi.fn();
      const mockPlayer = { getState: () => 'playing' } as any;
      handleVideoError(mockPlayer, onError);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('handleFeedError', () => {
    it('reports feed error', () => {
      const onError = vi.fn();
      handleFeedError(new Error('Parse error'), onError);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].type).toBe('feed');
    });
  });
});

// ─── Focus Style Tests ────────────────────────────────────────────────────────

describe('applyFocusStyle', () => {
  it('adds focused class and removes unfocused', () => {
    const el = document.createElement('button');
    applyFocusStyle(el as any, true);
    expect(el.classList.contains('focused')).toBe(true);
    expect(el.classList.contains('unfocused')).toBe(false);
  });

  it('adds unfocused class and removes focused', () => {
    const el = document.createElement('button');
    el.classList.add('focused');
    applyFocusStyle(el as any, false);
    expect(el.classList.contains('focused')).toBe(false);
    expect(el.classList.contains('unfocused')).toBe(true);
  });
});
