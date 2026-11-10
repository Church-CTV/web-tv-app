/**
 * WebOS ErrorHandling — unit tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getErrorScreen,
  renderErrorScreen,
  initErrorScreen,
  withErrorBoundary,
  handleVideoError,
  handleFeedError,
} from '../../src/utils/ErrorHandling';

describe('ErrorHandling', () => {
  describe('getErrorScreen', () => {
    it('returns correct error screen for network', () => {
      const err = getErrorScreen('network');
      expect(err.title).toBe('Connection Error');
      expect(err.retryable).toBe(true);
    });

    it('returns correct error screen for feed', () => {
      const err = getErrorScreen('feed');
      expect(err.retryable).toBe(true);
    });

    it('returns correct error screen for video', () => {
      const err = getErrorScreen('video');
      expect(err.retryable).toBe(true);
    });

    it('returns correct error screen for auth', () => {
      const err = getErrorScreen('auth');
      expect(err.retryable).toBe(true);
    });

    it('returns generic for unknown error type', () => {
      const err = getErrorScreen('generic');
      expect(err.retryable).toBe(true);
    });
  });

  describe('renderErrorScreen', () => {
    it('renders error screen HTML', () => {
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err);
      expect(html).toContain('error-screen');
      expect(html).toContain('Connection Error');
      expect(html).toContain('Unable to connect');
    });

    it('renders details when provided', () => {
      const err = getErrorScreen('generic');
      err.details = 'Detailed error info';
      const html = renderErrorScreen(err, vi.fn());
      expect(html).toContain('Detailed error info');
      expect(html).toContain('error-screen__details');
    });

    it('renders retry button when retryable and onRetry provided', () => {
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err, vi.fn());
      expect(html).toContain('btn-retry');
      expect(html).toContain('Try Again');
    });

    it('does not render retry button when not retryable', () => {
      const err = getErrorScreen('network');
      err.retryable = false;
      const html = renderErrorScreen(err);
      expect(html).not.toContain('btn-retry');
    });

    it('does not render retry button when onRetry not provided', () => {
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err);
      expect(html).not.toContain('btn-retry');
    });

    it('escapes HTML in error details', () => {
      const err = getErrorScreen('generic');
      err.details = '<script>alert(1)</script>';
      const html = renderErrorScreen(err, vi.fn());
      expect(html).toContain('&lt;script&gt;');
    });
    it('renders aria-live live region on error screen (WCAG 4.1.3 announcements)', () => {
      // Screen readers must announce error state changes.
      // Shared version (Tizen/Vizio) has role="alert"; webOS must match.
      const err = getErrorScreen('network');
      const html = renderErrorScreen(err);
      expect(html).toContain('role="alert"');
    });
  });

  describe('initErrorScreen', () => {
    it('wires up retry button', () => {
      const err = getErrorScreen('network');
      document.body.innerHTML = renderErrorScreen(err, vi.fn());
      const onRetry = vi.fn();
      initErrorScreen(onRetry);

      const retryBtn = document.getElementById('btn-retry');
      retryBtn?.dispatchEvent(new MouseEvent('click'));
      expect(onRetry).toHaveBeenCalled();
    });

    it('handles missing retry button gracefully', () => {
      document.body.innerHTML = '<div>no error screen</div>';
      expect(() => initErrorScreen(vi.fn())).not.toThrow();
    });
  });

  describe('withErrorBoundary', () => {
    it('calls fn on success', () => {
      const fn = vi.fn().mockReturnValue(42);
      const onError = vi.fn();
      const wrapped = withErrorBoundary(fn, onError);
      expect(wrapped()).toBe(42);
      expect(onError).not.toHaveBeenCalled();
    });

    it('calls onError on failure', () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('boom');
      });
      const onError = vi.fn();
      const wrapped = withErrorBoundary(fn, onError);
      wrapped();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('wraps non-Error exceptions', () => {
      const fn = vi.fn().mockImplementation(() => {
        throw 'string error';
      });
      const onError = vi.fn();
      const wrapped = withErrorBoundary(fn, onError);
      wrapped();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('handleVideoError', () => {
    it('reports video error when state is error', () => {
      const onError = vi.fn();
      handleVideoError({ getState: () => 'error' as const, stop: vi.fn() } as any, onError);
      expect(onError).toHaveBeenCalled();
    });

    it('does not report when state is not error', () => {
      const onError = vi.fn();
      handleVideoError({ getState: () => 'playing' as const, stop: vi.fn() } as any, onError);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('handleFeedError', () => {
    it('calls onError with feed error', () => {
      const onError = vi.fn();
      handleFeedError(new Error('feed error'), onError);
      expect(onError).toHaveBeenCalled();
    });
  });
});
