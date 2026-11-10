import { expect, it, vi } from 'vitest';

const diagnostics = vi.hoisted(() => {
  let resolve!: () => void;
  return {
    ready: new Promise<void>((done) => {
      resolve = done;
    }),
    release: () => resolve(),
    loaded: vi.fn(),
    create: vi.fn(),
    flush: vi.fn(),
    consent: false,
  };
});
vi.mock('../../src/modules/initCrashReporting', async () => {
  diagnostics.loaded();
  await diagnostics.ready;
  return { createCrashReporter: diagnostics.create, flushCrashReports: diagnostics.flush };
});
vi.mock('@ctv/core', async (original) => ({
  ...(await original<typeof import('@ctv/core')>()),
  getShareUsagePreference: () => diagnostics.consent,
}));
vi.mock('../../src/modules/initStorage', () => ({
  createStorage: () => ({ get: () => null, set: vi.fn(), remove: vi.fn(), getAll: () => ({}) }),
}));
vi.mock('../../src/modules/initAnalytics', () => ({
  createAnalytics: () => ({ setOptOut: vi.fn(), shutdown: vi.fn() }),
}));
vi.mock('../../src/modules/initVideoPlayer', () => ({ createVideoPlayer: vi.fn() }));
vi.mock('../../src/modules/initRemoteControl', () => ({
  createRemoteControl: () => ({ destroy: vi.fn() }),
}));
vi.mock('../../src/ui/SplashScreen', () => ({
  initSplashScreen: () => ({ dismiss: vi.fn() }),
}));
vi.mock('../../src/screenLoader', () => ({ loadMainView: vi.fn(async () => {}) }));

it('boots without diagnostics consent and guards deferred setup and flush across unload', async () => {
  let app: typeof import('../../src/App') | undefined;
  const imported = import('../../src/App').then((module) => {
    app = module;
  });
  try {
    await vi.waitFor(() => expect(app).toBeDefined());
    await app!.initApp();
    expect(diagnostics.loaded).not.toHaveBeenCalled();
    diagnostics.consent = true;
    await app!.initApp();
    await vi.waitFor(() => expect(diagnostics.loaded).toHaveBeenCalledOnce());
    window.dispatchEvent(new Event('beforeunload'));
    expect(diagnostics.flush).not.toHaveBeenCalled();
    diagnostics.release();
    await vi.waitFor(() => expect(diagnostics.create).not.toHaveBeenCalled());
    // Let the resolved import's continuation finish before checking its guard.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(diagnostics.create).not.toHaveBeenCalled();
    await app!.initApp();
    await vi.waitFor(() => expect(diagnostics.create).toHaveBeenCalledOnce());
    diagnostics.consent = false;
    window.dispatchEvent(new Event('beforeunload'));
    expect(diagnostics.flush).not.toHaveBeenCalled();
    diagnostics.consent = true;
    window.dispatchEvent(new Event('beforeunload'));
    expect(diagnostics.flush).toHaveBeenCalledOnce();
    const failure = new Error('Diagnostics unavailable');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      diagnostics.create.mockImplementationOnce(() => {
        throw failure;
      });
      await app!.initApp();
      await vi.waitFor(() =>
        expect(logged).toHaveBeenCalledWith(
          '[Tizen App] Diagnostics initialization failed:',
          failure
        )
      );
    } finally {
      logged.mockRestore();
    }
  } finally {
    diagnostics.release();
    await imported;
  }
});
