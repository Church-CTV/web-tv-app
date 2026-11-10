import { describe, test, expect } from 'vitest';
import { createSupportBundle } from '../../core/src/support-bundle/SupportBundle';

describe('SupportBundle', () => {
  test('creates a bundle with required sections', () => {
    const bundle = createSupportBundle({
      appVersion: '1.0.0',
      platform: 'webos',
      screenName: 'Home',
      crashes: [
        {
          errorName: 'TypeError',
          errorMessage: 'Cannot read property of null',
          timestamp: '2026-09-04T16:00:00Z',
          screenName: 'Home',
        },
      ],
      analytics: [
        {
          type: 'screen_view',
          screenName: 'Home',
          timestamp: '2026-09-04T15:59:00Z',
        },
      ],
    });

    expect(bundle).toBeDefined();
    expect(bundle.metadata).toBeDefined();
    expect(bundle.metadata.appVersion).toBe('1.0.0');
    expect(bundle.metadata.platform).toBe('webos');
    expect(bundle.metadata.bundleTimestamp).toBeDefined();
    expect(bundle.metadata.redacted).toBe(true);
    expect(bundle.crashes).toHaveLength(1);
    expect(bundle.crashes[0].errorName).toBe('TypeError');
    expect(bundle.analytics).toHaveLength(1);
  });

  test('redacts sensitive email addresses', () => {
    const bundle = createSupportBundle({
      appVersion: '1.0.0',
      platform: 'webos',
      crashes: [
        {
          errorName: 'Error',
          errorMessage: 'Failed for user@example.com',
          timestamp: '2026-09-04T16:00:00Z',
        },
      ],
    });

    expect(bundle.crashes[0].errorMessage).not.toContain('user@example.com');
  });

  test('redacts URLs with redaction markers', () => {
    const bundle = createSupportBundle({
      appVersion: '1.0.0',
      platform: 'webos',
      crashes: [
        {
          errorName: 'Error',
          errorMessage:
            'Request failed for user@example.com at https://api.example.com/v1/users/123?token=secret',
          timestamp: '2026-09-04T16:00:00Z',
        },
      ],
    });

    expect(bundle.crashes[0].errorMessage).not.toContain('user@example.com');
    expect(bundle.crashes[0].errorMessage).not.toContain('secret');
  });

  test('handles empty crashes and analytics', () => {
    const bundle = createSupportBundle({
      appVersion: '1.0.0',
      platform: 'tizen',
    });

    expect(bundle.crashes).toHaveLength(0);
    expect(bundle.analytics).toHaveLength(0);
    expect(bundle.metadata.platform).toBe('tizen');
  });

  test('redacts viewing history video IDs', () => {
    const bundle = createSupportBundle({
      appVersion: '1.0.0',
      platform: 'webos',
      analytics: [
        {
          type: 'content_play',
          contentId: 'vid-abc-123',
          title: 'My Favorite Show',
          timestamp: '2026-09-04T15:59:00Z',
        },
      ],
    });

    expect(bundle.analytics[0].contentId).not.toBe('vid-abc-123');
  });
});
