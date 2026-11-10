import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  let release!: () => void;
  return {
    ready: new Promise<void>((resolve) => {
      release = resolve;
    }),
    release: () => release(),
    importing: vi.fn(),
    analytics: vi.fn(),
    player: vi.fn(),
    remote: vi.fn(),
    main: vi.fn(),
    dismiss: vi.fn(),
  };
});
vi.mock('../../src/modules/initAnalytics', async () => {
  state.importing();
  await state.ready;
  return { createAnalytics: state.analytics };
});
vi.mock('../../src/modules/initStorage', () => ({
  createStorage: () => ({ get: () => null, set: vi.fn(), remove: vi.fn(), getAll: () => ({}) }),
}));
vi.mock('../../src/modules/initVideoPlayer', () => ({ createVideoPlayer: state.player }));
vi.mock('../../src/modules/initRemoteControl', () => ({ createRemoteControl: state.remote }));
vi.mock('../../src/ui/SplashScreen', () => ({
  initSplashScreen: () => ({ dismiss: state.dismiss }),
}));
vi.mock('../../src/screenLoader', () => ({ loadMainView: state.main }));

it('does not resume startup or install resources after unload during analytics import', async () => {
  const app = await import('../../src/App');
  const startup = app.initApp();
  try {
    await vi.waitFor(() => expect(state.importing).toHaveBeenCalled());
    window.dispatchEvent(new Event('beforeunload'));
    state.release();
    await startup;
    expect(state.analytics).not.toHaveBeenCalled();
    expect(state.player).not.toHaveBeenCalled();
    expect(state.remote).not.toHaveBeenCalled();
    expect(state.main).not.toHaveBeenCalled();
  } finally {
    state.release();
  }
});

it('does not attach focus observers after unload during main view loading', async () => {
  let finish!: () => void;
  state.analytics.mockReturnValue({ setOptOut: vi.fn(), shutdown: vi.fn() });
  state.remote.mockReturnValue({ destroy: vi.fn() });
  state.main.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    })
  );
  const app = await import('../../src/App');
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  const startup = app.initApp();
  try {
    await vi.waitFor(() => expect(state.main).toHaveBeenCalled());
    window.dispatchEvent(new Event('beforeunload'));
    finish();
    await startup;
    expect(observe).not.toHaveBeenCalled();
  } finally {
    observe.mockRestore();
  }
});
