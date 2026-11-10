/**
 * Shared DeepLinking — unit tests for the platform-agnostic deep link parser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseDeepLink, initDeepLinking } from '@ctv/shared/ui/DeepLinking';

describe('DeepLinking', () => {
  const originalHref = window.location.href;

  beforeEach(() => {
    // Reset URL for each test
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    // Restore original URL
    window.history.replaceState(null, '', originalHref);
  });

  describe('parseDeepLink', () => {
    it('parses hash deep link #content-video123', () => {
      window.history.replaceState(null, '', '/#content-video123');
      const result = parseDeepLink();
      expect(result.found).toBe(true);
      expect(result.videoId).toBe('video123');
      expect(result.source).toBe('hash');
    });

    it('parses contentId query param', () => {
      window.history.replaceState(null, '', '/?contentId=video456');
      const result = parseDeepLink();
      expect(result.found).toBe(true);
      expect(result.videoId).toBe('video456');
      expect(result.source).toBe('queryContentId');
    });

    it('parses videoId query param', () => {
      window.history.replaceState(null, '', '/?videoId=video789');
      const result = parseDeepLink();
      expect(result.found).toBe(true);
      expect(result.videoId).toBe('video789');
      expect(result.source).toBe('queryVideoId');
    });

    it('prefers hash over query params when both present', () => {
      window.history.replaceState(null, '', '/?contentId=query-video#content-hash-video');
      const result = parseDeepLink();
      expect(result.found).toBe(true);
      expect(result.videoId).toBe('hash-video');
      expect(result.source).toBe('hash');
    });

    it('prefers contentId over videoId query params when both present', () => {
      window.history.replaceState(null, '', '/?contentId=content-video&videoId=video-query');
      const result = parseDeepLink();
      expect(result.found).toBe(true);
      expect(result.videoId).toBe('content-video');
      expect(result.source).toBe('queryContentId');
    });

    it('returns not found when no deep link present', () => {
      const result = parseDeepLink();
      expect(result.found).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.source).toBeNull();
    });

    it('handles unrelated hash value', () => {
      window.history.replaceState(null, '', '/#settings');
      const result = parseDeepLink();
      expect(result.found).toBe(false);
    });

    it('handles empty contentId query param', () => {
      window.history.replaceState(null, '', '/?contentId=');
      const result = parseDeepLink();
      expect(result.found).toBe(false);
    });
  });

  describe('initDeepLinking', () => {
    it('navigates to matching video on checkAndNavigate', () => {
      window.history.replaceState(null, '', '/#content-video1');
      const onNavigate = vi.fn();
      const onError = vi.fn();
      const { checkAndNavigate } = initDeepLinking(onNavigate, onError);

      const result = checkAndNavigate([
        { videoId: 'video1', title: 'Video One' },
        { videoId: 'video2', title: 'Video Two' },
      ]);

      expect(result).toBe(true);
      expect(onNavigate).toHaveBeenCalledWith('video1', 'Video One');
      expect(onError).not.toHaveBeenCalled();
    });

    it('calls onError when video not found in feed', () => {
      window.history.replaceState(null, '', '/#content-notfound');
      const onNavigate = vi.fn();
      const onError = vi.fn();
      const { checkAndNavigate } = initDeepLinking(onNavigate, onError);

      const result = checkAndNavigate([{ videoId: 'video1', title: 'Video One' }]);

      expect(result).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('Content "notfound" not found. Please try again later.');
    });

    it('returns false without side effects when no deep link present', () => {
      const onNavigate = vi.fn();
      const onError = vi.fn();
      const { checkAndNavigate } = initDeepLinking(onNavigate, onError);

      const result = checkAndNavigate([{ videoId: 'video1', title: 'Video One' }]);

      expect(result).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('getDeepLink returns parsed result without navigating', () => {
      window.history.replaceState(null, '', '/#content-video99');
      const { getDeepLink } = initDeepLinking(vi.fn(), vi.fn());
      const result = getDeepLink();
      expect(result.found).toBe(true);
      expect(result.videoId).toBe('video99');
    });
  });
});
