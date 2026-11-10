/**
 * Crash Reporter tests — capture, save, retrieve crash reports.
 */

import { describe, it, expect } from 'vitest';
import {
  captureError,
  saveCrash,
  getPendingCrashes,
  clearCrashes,
  handleUnhandledError,
} from './CrashReporter';

function makeMockStore() {
  const store: Record<string, string> = {};
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, val: string) => {
      store[key] = val;
    },
    remove: (key: string) => {
      delete store[key];
    },
  };
}

describe('CrashReporter', () => {
  it('captures an error as a crash report', () => {
    const report = captureError(new Error('Test error'));
    expect(report.errorName).toBe('Error');
    expect(report.errorMessage).toBe('Test error');
    expect(report.timestamp).toBeDefined();
  });

  it('captures a string error', () => {
    const report = captureError('Simple error message');
    expect(report.errorMessage).toBe('Simple error message');
  });

  it('includes optional context (screenName, videoId)', () => {
    const report = captureError(new Error('Test'), { screenName: 'Home', videoId: 'video-1' });
    expect(report.screenName).toBe('Home');
    expect(report.videoId).toBe('video-1');
  });

  it('saves a crash report', () => {
    const store = makeMockStore();
    const report = captureError(new Error('Test'));
    saveCrash(store, report);
    expect(getPendingCrashes(store)).toHaveLength(1);
  });

  it('retrieves pending crashes', () => {
    const store = makeMockStore();
    saveCrash(store, captureError(new Error('Error 1')));
    saveCrash(store, captureError(new Error('Error 2')));
    expect(getPendingCrashes(store)).toHaveLength(2);
  });

  it('clears crash reports', () => {
    const store = makeMockStore();
    saveCrash(store, captureError(new Error('Test')));
    clearCrashes(store);
    expect(getPendingCrashes(store)).toHaveLength(0);
  });

  it('handles unhandled errors', () => {
    const store = makeMockStore();
    handleUnhandledError(new Error('Unhandled'), store);
    expect(getPendingCrashes(store)).toHaveLength(1);
  });

  it('handles string unhandled errors', () => {
    const store = makeMockStore();
    handleUnhandledError(new Error('String error'), store);
    expect(getPendingCrashes(store)[0].errorMessage).toBe('String error');
  });
});
