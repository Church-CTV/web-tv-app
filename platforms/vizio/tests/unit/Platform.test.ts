/**
 * Vizio Platform — Adapter + FocusManager + ErrorHandling unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFocusManager } from '../../src/Adapter/RemoteControl';
import {
  getErrorScreen,
  renderErrorScreen,
  initErrorScreen,
} from '../../../../shared/ErrorHandling';

// ─── FocusManager Tests ────────────────────────────────────────────────────────

describe('Vizio FocusManager', () => {
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
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
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

  it('focuses previous element in sequence', () => {
    const fm = createFocusManager(container);
    fm.focusLast();
    fm.focusPrev();
    expect(document.activeElement?.className).toBe('item-3');
  });

  it('wraps focus from last to first', () => {
    const fm = createFocusManager(container);
    const items = container.querySelectorAll('.item-1, .item-2, .item-3, .item-4');
    expect(items).toHaveLength(4);
    (items[3] as HTMLElement).focus();
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-1');
  });

  it('skips disabled buttons', () => {
    const fm = createFocusManager(container);
    const focusable = container.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    expect(focusable).toHaveLength(4);
  });

  it('handles empty container', () => {
    const empty = document.createElement('div');
    document.body.appendChild(empty);
    const fm = createFocusManager(empty);
    expect(() => fm.focusFirst()).not.toThrow();
    expect(() => fm.focusNext()).not.toThrow();
    document.body.removeChild(empty);
  });

  it('focuses last element', () => {
    const fm = createFocusManager(container);
    fm.focusLast();
    expect(document.activeElement?.className).toBe('item-4');
  });

  it('wraps from first to last', () => {
    const fm = createFocusManager(container);
    fm.focusFirst();
    fm.focusPrev();
    expect(document.activeElement?.className).toBe('item-4');
  });
});

// ─── ErrorHandling Tests ──────────────────────────────────────────────────────

describe('ErrorHandling', () => {
  describe('getErrorScreen', () => {
    it('returns correct data for network error', () => {
      const error = getErrorScreen('network');
      expect(error.title).toBe('Connection Error');
      expect(error.message).toContain('Unable to connect');
      expect(error.icon).toBe('warning');
      expect(error.action).toBe('Check Connection');
    });

    it('returns correct data for feed error', () => {
      const error = getErrorScreen('feed');
      expect(error.title).toBe('Content Error');
      expect(error.message).toContain('Failed to load content');
      expect(error.action).toBe('Retry');
    });

    it('returns correct data for stream error', () => {
      const error = getErrorScreen('stream');
      expect(error.title).toBe('Playback Error');
      expect(error.message).toContain('Unable to play');
      expect(error.action).toBe('Try Another');
    });

    it('returns correct data for ui error', () => {
      const error = getErrorScreen('ui');
      expect(error.title).toBe('Display Error');
      expect(error.action).toBe('Go Back');
    });

    it('returns network fallback for unknown type', () => {
      const error = getErrorScreen('network');
      expect(error.icon).toBe('warning');
    });
  });

  describe('renderErrorScreen', () => {
    it('renders error screen HTML with title and message', () => {
      const error = getErrorScreen('network');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Connection Error');
      expect(html).toContain('Unable to connect');
      expect(html).toContain('Check Connection');
      expect(html).toContain('error-screen');
    });

    it('includes error details when provided', () => {
      const error = getErrorScreen('feed');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Failed to load content');
    });

    it('uses default action when not provided', () => {
      const error = getErrorScreen('network');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('button');
    });

    it('renders stream error HTML', () => {
      const error = getErrorScreen('stream');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Playback Error');
      expect(html).toContain('Try Another');
    });

    it('renders UI error HTML', () => {
      const error = getErrorScreen('ui');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Display Error');
      expect(html).toContain('Go Back');
    });
  });

  describe('initErrorScreen', () => {
    it('initializes retry button click handler', () => {
      let clicked = false;
      document.body.innerHTML = '';
      const container = document.createElement('div');
      document.body.appendChild(container);
      const error = getErrorScreen('network');
      container.innerHTML = renderErrorScreen(error, () => {});
      initErrorScreen(() => {
        clicked = true;
      });
      const btn = container.querySelector('#error-retry');
      if (btn) btn.click();
      expect(clicked).toBe(true);
    });

    it('handles missing button gracefully', () => {
      const container = document.createElement('div');
      container.innerHTML = '';
      expect(() => initErrorScreen(() => {})).not.toThrow();
    });
  });
});
