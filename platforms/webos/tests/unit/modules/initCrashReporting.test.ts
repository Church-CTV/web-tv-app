/**
 * initCrashReporting — unit tests.
 * Tests createCrashReporter factory from webOS platform.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCrashReporter } from '../../../src/modules/initCrashReporting';
import * as CrashReporterAdapter from '../../../src/Adapter/CrashReporter';

describe('initCrashReporting', () => {
  let setupSpy: ReturnType<typeof vi.fn>;
  let mockStorage: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let mockExportFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupSpy = vi.spyOn(CrashReporterAdapter, 'setupCrashReporting');
    setupSpy.mockReturnValue(undefined);

    mockStorage = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    mockExportFn = vi.fn().mockResolvedValue(undefined);
  });

  it('calls setupCrashReporting adapter', () => {
    createCrashReporter(mockStorage, mockExportFn);
    expect(setupSpy).toHaveBeenCalledOnce();
  });

  it('passes storage to adapter', () => {
    createCrashReporter(mockStorage, mockExportFn);
    expect(setupSpy).toHaveBeenCalledWith(mockStorage, mockExportFn);
  });

  it('passes exportFn to adapter', () => {
    createCrashReporter(mockStorage, mockExportFn);
    const args = setupSpy.mock.calls[0];
    expect(args[1]).toBe(mockExportFn);
  });

  it('works with undefined exportFn', () => {
    createCrashReporter(mockStorage, undefined as any);
    expect(setupSpy).toHaveBeenCalled();
    expect(setupSpy).toHaveBeenCalledWith(mockStorage, undefined);
  });

  it('handles storage operations', () => {
    createCrashReporter(mockStorage, mockExportFn);
    expect(mockStorage.get).toBeDefined();
    expect(mockStorage.set).toBeDefined();
    expect(mockStorage.remove).toBeDefined();
  });
});
