/**
 * screenLoader.ts — unit tests.
 *
 * Tests that each dynamic-import loader in screenLoader.ts is a function
 * that returns a Promise and delegates to the underlying screen module.
 * This is the code-split boundary — a regression here silently bundles
 * everything again, so the loaders must be exercised in isolation.
 *
 * The underlying screen/ui modules are mocked with vi.mock so the dynamic
 * imports resolve to mocks and coverage lands on screenLoader.ts itself.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all screen modules dynamically imported by screenLoader.ts.
vi.mock('../../../src/screens/HomeScreen', () => ({
  loadMainView: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/screens/SettingsScreen', () => ({
  loadSettingsScreen: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/screens/SearchScreen', () => ({
  loadSearchScreen: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../src/ui/ContentDetail', () => ({
  createContentDetail: vi.fn(() => {
    const el = document.createElement('div');
    (el as HTMLDivElement & { cleanup: () => void }).cleanup = () => {};
    return el;
  }),
}));
vi.mock('../../../src/ui/VideoScreen', () => ({
  createVideoScreen: vi.fn(() => document.createElement('div')),
}));

const storage: {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getAll(): Record<string, string>;
} = {
  get: () => null,
  set: () => {},
  remove: () => {},
  getAll: () => ({}),
};

const actions = {
  onVideoSelect: vi.fn(),
  onSearch: vi.fn(),
  onSettings: vi.fn(),
  onRetry: vi.fn(),
  onFeedLoaded: vi.fn(),
};

describe('webOS screenLoader (code-split boundary)', () => {
  let loader: typeof import('../../../src/screenLoader');

  beforeEach(async () => {
    vi.clearAllMocks();
    loader = await import('../../../src/screenLoader');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exports loadMainView as a function', () => {
    expect(typeof loader.loadMainView).toBe('function');
  });

  it('loadMainView returns a Promise and delegates to HomeScreen.loadMainView', async () => {
    const result = loader.loadMainView(storage, { trackInteraction: vi.fn() }, actions);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const homeScreen = await import('../../../src/screens/HomeScreen');
    expect(homeScreen.loadMainView).toHaveBeenCalledTimes(1);
    expect(homeScreen.loadMainView).toHaveBeenCalledWith(
      storage,
      expect.objectContaining({ trackInteraction: expect.any(Function) }),
      actions
    );
  });

  it('loadMainView propagates a rejecting Promise from the implementation', async () => {
    const homeScreen = await import('../../../src/screens/HomeScreen');
    vi.mocked(homeScreen.loadMainView).mockRejectedValueOnce(new Error('chunk failed'));
    await expect(loader.loadMainView(storage, null, actions)).rejects.toThrow('chunk failed');
  });

  it('exports loadSettingsScreen as a function and delegates', async () => {
    const result = loader.loadSettingsScreen(storage);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const settings = await import('../../../src/screens/SettingsScreen');
    expect(settings.loadSettingsScreen).toHaveBeenCalledTimes(1);
  });

  it('exports loadSearchScreen as a function and delegates videos + callback', async () => {
    const videos = [{ videoId: 'v1', title: 'Test', thumbnail: '', progress: 0 }];
    const onVideoSelect = vi.fn();
    const result = loader.loadSearchScreen(videos, onVideoSelect);
    expect(result).toBeInstanceOf(Promise);
    await result;

    const search = await import('../../../src/screens/SearchScreen');
    expect(search.loadSearchScreen).toHaveBeenCalledTimes(1);
    expect(search.loadSearchScreen).toHaveBeenCalledWith(videos, onVideoSelect);
  });

  it('exports createContentDetail as a function returning an element with cleanup', async () => {
    const video = {
      id: 'v1',
      title: 'Test',
      shortDescription: '',
      thumbnail: '',
      hdPosterUrl: '',
      sdPosterUrl: '',
      url: '',
      releaseDate: '',
      genres: [] as string[],
      content: { duration: 0, videos: [] as { url: string; quality: string; videoType: string }[] },
    };
    const detail = await loader.createContentDetail(video);
    expect(detail instanceof HTMLElement).toBe(true);
    expect(typeof detail.cleanup).toBe('function');
  });

  it('createContentDetail propagates callbacks', async () => {
    const video = {
      id: 'v1',
      title: 'Test',
      shortDescription: '',
      thumbnail: '',
      hdPosterUrl: '',
      sdPosterUrl: '',
      url: '',
      releaseDate: '',
      genres: [] as string[],
      content: { duration: 0, videos: [] as { url: string; quality: string; videoType: string }[] },
    };
    const callbacks = { onBack: vi.fn() } as never;
    const detail = await loader.createContentDetail(video, callbacks);
    expect(detail instanceof HTMLElement).toBe(true);
    const cd = await import('../../../src/ui/ContentDetail');
    expect(cd.createContentDetail).toHaveBeenCalledWith(video, callbacks);
  });

  it('exports createVideoScreen as a function returning a container element', async () => {
    const props = { onBack: vi.fn() } as never;
    const screen = await loader.createVideoScreen(props);
    expect(screen instanceof HTMLDivElement).toBe(true);
  });
});
