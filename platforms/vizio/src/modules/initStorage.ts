/**
 * Tizen Storage adapter initialization module.
 */

import { createStorageAdapter } from '../Adapter/Storage';

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getAll(): Record<string, string>;
}

export function createStorage(): StorageAdapter {
  return createStorageAdapter();
}
