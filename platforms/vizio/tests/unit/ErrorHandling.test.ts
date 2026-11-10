/**
 * Vizio — shared ErrorHandling utility tests.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getErrorScreen,
  renderErrorScreen,
  initErrorScreen,
} from '../../../../shared/ErrorHandling';

describe('ErrorHandling', () => {
  describe('getErrorScreen', () => {
    it('returns correct data for network error', () => {
      const err = getErrorScreen('network');
      expect(err.title).toBe('Connection Error');
      expect(err.message).toContain('Unable to connect');
      expect(err.icon).toBe('warning');
      expect(err.action).toBe('Check Connection');
    });

    it('returns correct data for feed error', () => {
      const err = getErrorScreen('feed');
      expect(err.title).toBe('Content Error');
      expect(err.action).toBe('Retry');
    });

    it('returns correct data for ui error', () => {
      const err = getErrorScreen('ui');
      expect(err.title).toBe('Display Error');
      expect(err.action).toBe('Go Back');
    });

    it('returns correct data for stream error', () => {
      const err = getErrorScreen('stream');
      expect(err.title).toBe('Playback Error');
      expect(err.action).toBe('Try Another');
    });

    it('returns network error for unknown type', () => {
      const err = getErrorScreen('network');
      expect(err.title).toBe('Connection Error');
    });

    it('returns ErrorScreenData for all valid types', () => {
      for (const type of ['network', 'feed', 'ui', 'stream'] as const) {
        const err = getErrorScreen(type);
        expect(err).toHaveProperty('title');
        expect(err).toHaveProperty('message');
        expect(err).toHaveProperty('icon');
      }
    });
  });

  describe('renderErrorScreen', () => {
    it('renders error screen HTML with the drawn icon', () => {
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err, () => {});
      expect(html).toContain('error-screen');
      expect(html).toContain('Connection Error');
      expect(html).toContain('<svg');
      expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\uFE0F/u);
    });

    it('renders error screen HTML with message', () => {
      const err = getErrorScreen('feed');
      const html = renderErrorScreen(err, () => {});
      expect(html).toContain('Failed to load content');
    });

    it('renders retry button with action text', () => {
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err, () => {});
      expect(html).toContain('error-retry');
      expect(html).toContain('Check Connection');
    });

    it('renders button-primary class', () => {
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err, () => {});
      expect(html).toContain('button-primary');
    });

    it('includes role=alert for accessibility', () => {
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err, () => {});
      expect(html).toContain('role="alert"');
    });
  });

  describe('initErrorScreen', () => {
    it('wires up retry button', () => {
      const html = renderErrorScreen(getErrorScreen('network'), () => {});
      document.body.innerHTML = html;
      const onRetry = vi.fn();
      initErrorScreen(onRetry);

      const retryBtn = document.getElementById('error-retry');
      retryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onRetry).toHaveBeenCalled();
    });

    it('handles missing retry button gracefully', () => {
      document.body.innerHTML = '<div>no error screen</div>';
      expect(() => initErrorScreen(vi.fn())).not.toThrow();
    });
  });
});
