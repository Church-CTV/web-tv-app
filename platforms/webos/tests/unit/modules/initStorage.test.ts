/**
 * initStorage — unit tests.
 * Tests createStorage factory from webOS platform.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStorage } from '../../../src/modules/initStorage';
import * as StorageAdapter from '../../../src/Adapter/Storage';

describe('initStorage', () => {
  let createAdapterSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createAdapterSpy = vi.spyOn(StorageAdapter, 'createStorageAdapter');
  });

  it('calls createStorageAdapter', () => {
    const storage = createStorage();
    expect(createAdapterSpy).toHaveBeenCalledOnce();
  });

  it('returns the result from createStorageAdapter', () => {
    const mockAdapter = { get: vi.fn(), set: vi.fn(), remove: vi.fn(), getAll: vi.fn() };
    createAdapterSpy.mockReturnValue(mockAdapter as any);

    const storage = createStorage();
    expect(storage).toBe(mockAdapter);
  });

  it('storage get delegates to adapter', () => {
    const mockGet = vi.fn().mockReturnValue('stored-value');
    createAdapterSpy.mockReturnValue({
      get: mockGet,
      set: vi.fn(),
      remove: vi.fn(),
      getAll: vi.fn(),
    } as any);

    const storage = createStorage();
    const value = storage.get('my-key');
    expect(mockGet).toHaveBeenCalledWith('my-key');
    expect(value).toBe('stored-value');
  });

  it('storage set delegates to adapter', () => {
    const mockSet = vi.fn();
    createAdapterSpy.mockReturnValue({
      get: vi.fn(),
      set: mockSet,
      remove: vi.fn(),
      getAll: vi.fn(),
    } as any);

    const storage = createStorage();
    storage.set('key', 'value');
    expect(mockSet).toHaveBeenCalledWith('key', 'value');
  });

  it('storage remove delegates to adapter', () => {
    const mockRemove = vi.fn();
    createAdapterSpy.mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      remove: mockRemove,
      getAll: vi.fn(),
    } as any);

    const storage = createStorage();
    storage.remove('key');
    expect(mockRemove).toHaveBeenCalledWith('key');
  });
});
