/**
 * WebOS Storage Adapter — unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStorageAdapter } from '../../src/Adapter/Storage';

describe('Storage Adapter', () => {
  let storage: ReturnType<typeof createStorageAdapter>;

  beforeEach(() => {
    localStorage.clear();
    storage = createStorageAdapter();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('sets and gets a key', () => {
    storage.set('test-key', 'test-value');
    expect(storage.get('test-key')).toBe('test-value');
  });

  it('returns null for missing key', () => {
    expect(storage.get('nonexistent')).toBeNull();
  });

  it('removes a key', () => {
    storage.set('remove-me', 'value');
    storage.remove('remove-me');
    expect(storage.get('remove-me')).toBeNull();
  });

  it('gets all stored keys', () => {
    storage.set('key1', 'val1');
    storage.set('key2', 'val2');
    const all = storage.getAll();
    expect(all['key1']).toBe('val1');
    expect(all['key2']).toBe('val2');
  });

  it('overwrites existing value', () => {
    storage.set('key', 'first');
    storage.set('key', 'second');
    expect(storage.get('key')).toBe('second');
  });

  it('handles localStorage full gracefully', () => {
    // Override set to throw
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'localStorage full');
    });
    // Should not throw
    expect(() => storage.set('overflow', 'value')).not.toThrow();
    vi.restoreAllMocks();
  });
});
