/**
 * Tizen initStorage — unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage } from '../../src/modules/initStorage';
import type { StorageAdapter } from '../../src/modules/initStorage';

describe('Tizen initStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a storage adapter', () => {
    const storage = createStorage();
    expect(storage).toBeDefined();
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.set).toBe('function');
    expect(typeof storage.remove).toBe('function');
    expect(typeof storage.getAll).toBe('function');
  });

  it('stores and retrieves values', () => {
    const storage = createStorage();
    storage.set('testKey', 'testValue');
    expect(storage.get('testKey')).toBe('testValue');
  });

  it('returns null for non-existent keys', () => {
    const storage = createStorage();
    expect(storage.get('nonexistent')).toBeNull();
  });

  it('removes keys', () => {
    const storage = createStorage();
    storage.set('removeMe', 'value');
    storage.remove('removeMe');
    expect(storage.get('removeMe')).toBeNull();
  });

  it('getAll returns all stored key-value pairs', () => {
    const storage = createStorage();
    storage.set('a', '1');
    storage.set('b', '2');
    storage.set('c', '3');
    const all = storage.getAll();
    expect(all).toHaveProperty('a', '1');
    expect(all).toHaveProperty('b', '2');
    expect(all).toHaveProperty('c', '3');
  });

  it('overwrites existing values on set', () => {
    const storage = createStorage();
    storage.set('key', 'first');
    storage.set('key', 'second');
    expect(storage.get('key')).toBe('second');
  });
});
