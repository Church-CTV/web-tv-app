/**
 * Tizen ErrorHandling — unit tests for shared ErrorHandling.
 */

import { describe, it, expect } from 'vitest';
import { getErrorScreen, renderErrorScreen } from '../../../../shared/ErrorHandling';

describe('Tizen ErrorHandling', () => {
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

    it('returns network fallback for unknown type', () => {
      const error = getErrorScreen('network');
      expect(error.icon).toBe('warning');
    });
  });

  describe('renderErrorScreen', () => {
    it('renders error screen HTML with retry button', () => {
      const error = getErrorScreen('network');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Connection Error');
      expect(html).toContain('Check Connection');
      expect(html).toContain('error-retry');
    });

    it('renders error with specific message', () => {
      const error = getErrorScreen('feed');
      const html = renderErrorScreen(error, () => {});
      expect(html).toContain('Failed to load content');
    });
  });
});
