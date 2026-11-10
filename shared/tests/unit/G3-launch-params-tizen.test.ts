/**
 * G3 LaunchParams — Tizen TV launch parameter tests.
 * Tests readTizenLaunchParams() and getTizenAppControl() with mocked Tizen SDK.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readTizenLaunchParams, getTizenAppControl } from '@ctv/shared/ui/LaunchParams.tizen';

describe('LaunchParams.tizen — readTizenLaunchParams', () => {
  it('returns not found when appControl is null', () => {
    const result = readTizenLaunchParams(null);
    expect(result.found).toBe(false);
    expect(result.videoId).toBeNull();
  });

  it('returns not found when appControl is undefined', () => {
    const result = readTizenLaunchParams(undefined);
    expect(result.found).toBe(false);
    expect(result.videoId).toBeNull();
  });

  it('returns not found when appControl has no payload', () => {
    const result = readTizenLaunchParams({ type: 'http://example.com' });
    expect(result.found).toBe(false);
    expect(result.videoId).toBeNull();
  });

  it('parses contentId from JSON payload', () => {
    const result = readTizenLaunchParams({
      payload: JSON.stringify({ contentId: 'vid123' }),
    });
    expect(result.found).toBe(true);
    expect(result.videoId).toBe('vid123');
  });

  it('parses videoId from JSON payload', () => {
    const result = readTizenLaunchParams({
      payload: JSON.stringify({ videoId: 'vid456' }),
    });
    expect(result.found).toBe(true);
    expect(result.videoId).toBe('vid456');
  });

  it('prefers contentId over videoId when both present in payload', () => {
    const result = readTizenLaunchParams({
      payload: JSON.stringify({ contentId: 'content-vid', videoId: 'video-vid' }),
    });
    expect(result.found).toBe(true);
    expect(result.videoId).toBe('content-vid');
  });

  it('treats non-JSON payload as raw content ID', () => {
    const result = readTizenLaunchParams({
      payload: 'raw-video-id-789',
    });
    expect(result.found).toBe(true);
    expect(result.videoId).toBe('raw-video-id-789');
  });

  it('returns not found for empty payload string', () => {
    const result = readTizenLaunchParams({ payload: '' });
    expect(result.found).toBe(false);
    expect(result.videoId).toBeNull();
  });

  it('returns not found for whitespace-only payload', () => {
    const result = readTizenLaunchParams({ payload: '   ' });
    expect(result.found).toBe(false);
    expect(result.videoId).toBeNull();
  });

  it('returns not found for JSON payload without recognized keys', () => {
    const result = readTizenLaunchParams({
      payload: JSON.stringify({ someOtherField: 'value' }),
    });
    expect(result.found).toBe(false);
    expect(result.videoId).toBeNull();
  });
});

describe('LaunchParams.tizen — getTizenAppControl', () => {
  const originalWindow = window;

  beforeEach(() => {
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when tizen SDK is not present', () => {
    const result = getTizenAppControl();
    expect(result).toBeNull();
  });

  it('returns null when tizen.application is not present', () => {
    vi.stubGlobal('window', { tizen: {} });
    const result = getTizenAppControl();
    expect(result).toBeNull();
  });

  it('returns null when getRequestedAppControl is not a function', () => {
    vi.stubGlobal('window', { tizen: { application: {} } });
    const result = getTizenAppControl();
    expect(result).toBeNull();
  });

  it('returns the AppControl from the Tizen SDK', () => {
    const mockAppControl = { payload: '{"contentId":"tvid1"}', type: 'http://example.com' };
    vi.stubGlobal('window', {
      tizen: {
        application: {
          getRequestedAppControl: () => mockAppControl,
        },
      },
    });
    const result = getTizenAppControl();
    expect(result).toEqual(mockAppControl);
  });

  it('returns null when getRequestedAppControl returns undefined', () => {
    vi.stubGlobal('window', {
      tizen: {
        application: {
          getRequestedAppControl: () => undefined,
        },
      },
    });
    const result = getTizenAppControl();
    expect(result).toBeNull();
  });
});
