/**
 * Tizen Storage — unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStorageAdapter } from '../../src/Adapter/Storage';

describe('Tizen Storage', () => {
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

  it('handles empty localStorage', () => {
    const all = storage.getAll();
    expect(Object.keys(all)).toHaveLength(0);
  });

  it('handles special characters in keys', () => {
    storage.set('key/with/slashes', 'val');
    expect(storage.get('key/with/slashes')).toBe('val');
  });

  it('handles empty string values', () => {
    storage.set('empty', '');
    expect(storage.get('empty')).toBe('');
  });

  // Fail-closed paths (Samsung devices can deny localStorage under pressure).
  it('returns null when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(storage.get('any')).toBeNull();
    spy.mockRestore();
  });

  it('swallows errors when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => storage.set('any', 'v')).not.toThrow();
    spy.mockRestore();
  });

  it('swallows errors when localStorage.removeItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => storage.remove('any')).not.toThrow();
    spy.mockRestore();
  });
});
