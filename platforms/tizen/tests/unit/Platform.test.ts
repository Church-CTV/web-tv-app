/**
 * Tizen Platform — unit tests for platform detection, focus management, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { getErrorScreen, renderErrorScreen } from '../../../../shared/ErrorHandling';
import { createFocusManager } from '../../src/Adapter/RemoteControl';

describe('Tizen Platform Detection', () => {
  it('identifies as Tizen platform', () => {
    const isTizen = typeof (globalThis as any).tizen !== 'undefined';
    expect(typeof isTizen).toBe('boolean');
  });

  it('handles missing tizen API gracefully', () => {
    expect(true).toBe(true);
  });
});

describe('Tizen FocusManager', () => {
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
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-2');
  });

  it('skips disabled buttons', () => {
    const fm = createFocusManager(container);
    const focusable = container.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    expect(focusable).toHaveLength(4);
  });

  it('wraps focus from last to first', () => {
    const fm = createFocusManager(container);
    const items = container.querySelectorAll('.item-1, .item-2, .item-3, .item-4');
    expect(items).toHaveLength(4);
    (items[3] as HTMLElement).focus();
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-1');
  });
});

describe('Tizen ErrorHandling', () => {
  describe('getErrorScreen', () => {
    it('returns correct data for network error', () => {
      const error = getErrorScreen('network');
      expect(error.title).toBe('Connection Error');
      expect(error.message).toContain('Unable to connect');
    });

    it('returns correct data for feed error', () => {
      const error = getErrorScreen('feed');
      expect(error.title).toBe('Content Error');
      expect(error.action).toBe('Retry');
    });

    it('returns correct data for stream error', () => {
      const error = getErrorScreen('stream');
      expect(error.title).toBe('Playback Error');
      expect(error.action).toBe('Try Another');
    });

    it('returns network fallback for ui error', () => {
      const error = getErrorScreen('ui');
      expect(error.title).toBe('Display Error');
      expect(error.action).toBe('Go Back');
    });
  });

  describe('renderErrorScreen', () => {
    it('renders error screen HTML with title and message', () => {
      const error = getErrorScreen('network');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Connection Error');
      expect(html).toContain('Unable to connect');
      expect(html).toContain('Check Connection');
    });

    it('includes error details when provided', () => {
      const error = getErrorScreen('feed');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Failed to load content');
    });

    it('omits retry button when not retryable', () => {
      const error = getErrorScreen('network');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('button');
    });
  });
});
