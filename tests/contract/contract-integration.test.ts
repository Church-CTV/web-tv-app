/**
 * Contract Integration Tests — verifies that platform adapters implement
 * @ctv/core interfaces correctly.
 *
 * Run from root: npx vitest run tests/contract/
 */

import { describe, it, expect } from 'vitest';

describe('StorageAdapter Contract', () => {
  // webOS storage
  it('webOS: StorageAdapter implements get/set/remove', async () => {
    const { createStorageAdapter } = await import('../../platforms/webos/src/Adapter/Storage');
    const storage = createStorageAdapter();
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.set).toBe('function');
    expect(typeof storage.remove).toBe('function');

    storage.set('test-key', 'test-value');
    expect(storage.get('test-key')).toBe('test-value');
    storage.remove('test-key');
    expect(storage.get('test-key')).toBeNull();
  });

  // Tizen storage
  it('Tizen: StorageAdapter implements get/set/remove', async () => {
    const { createStorageAdapter } = await import('../../platforms/tizen/src/Adapter/Storage');
    const storage = createStorageAdapter();
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.set).toBe('function');
    expect(typeof storage.remove).toBe('function');

    storage.set('test-key', 'test-value');
    expect(storage.get('test-key')).toBe('test-value');
    storage.remove('test-key');
    expect(storage.get('test-key')).toBeNull();
  });

  // Vizio storage
  it('Vizio: StorageAdapter implements get/set/remove', async () => {
    const { createStorageAdapter } = await import('../../platforms/vizio/src/Adapter/Storage');
    const storage = createStorageAdapter();
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.set).toBe('function');
    expect(typeof storage.remove).toBe('function');

    storage.set('test-key', 'test-value');
    expect(storage.get('test-key')).toBe('test-value');
    storage.remove('test-key');
    expect(storage.get('test-key')).toBeNull();
  });
});

describe('VideoPlayer Contract', () => {
  it('webOS: VideoPlayer adapter exported', async () => {
    const { createVideoPlayer } = await import('../../platforms/webos/src/Adapter/VideoPlayer');
    expect(typeof createVideoPlayer).toBe('function');
  });

  it('Tizen: VideoPlayer adapter exported', async () => {
    const { createVideoPlayer } = await import('../../platforms/tizen/src/Adapter/VideoPlayer');
    expect(typeof createVideoPlayer).toBe('function');
  });

  it('Vizio: VideoPlayer adapter exported', async () => {
    const { createVideoPlayer } = await import('../../platforms/vizio/src/Adapter/VideoPlayer');
    expect(typeof createVideoPlayer).toBe('function');
  });
});

describe('Analytics Contract', () => {
  it('webOS: Analytics export function exists', async () => {
    const { createAnalyticsExport } = await import('../../platforms/webos/src/Adapter/Analytics');
    expect(typeof createAnalyticsExport).toBe('function');
  });

  it('Tizen: Analytics export function exists', async () => {
    const { createAnalyticsExport } = await import('../../platforms/tizen/src/Adapter/Analytics');
    expect(typeof createAnalyticsExport).toBe('function');
  });

  it('Vizio: Analytics export function exists', async () => {
    const { createAnalyticsExport } = await import('../../platforms/vizio/src/Adapter/Analytics');
    expect(typeof createAnalyticsExport).toBe('function');
  });
});

describe('CrashReporter Contract', () => {
  it('webOS: CrashReporter exports setup and flush', async () => {
    const { setupCrashReporting, flushCrashReports } =
      await import('../../platforms/webos/src/Adapter/CrashReporter');
    expect(typeof setupCrashReporting).toBe('function');
    expect(typeof flushCrashReports).toBe('function');
  });

  it('Tizen: CrashReporter exports setup', async () => {
    const { setupCrashReporting } = await import('../../platforms/tizen/src/Adapter/CrashReporter');
    expect(typeof setupCrashReporting).toBe('function');
  });

  it('Vizio: CrashReporter exports setup', async () => {
    const { setupCrashReporting } = await import('../../platforms/vizio/src/Adapter/CrashReporter');
    expect(typeof setupCrashReporting).toBe('function');
  });
});
