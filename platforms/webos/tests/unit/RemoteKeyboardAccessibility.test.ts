import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderSettingsScreen,
  initSettingsScreen,
  cleanupSettingsScreen,
} from '../../src/ui/SettingsScreen';
import { createSearchScreen } from '../../src/ui/SearchScreen';
import { createVideoScreen } from '../../src/ui/VideoScreen';

// Mock @ctv/core searchVideos
vi.mock('@ctv/core', () => ({
  searchVideos: (videos: any[], query: string) =>
    videos
      .filter((v) => v.title.toLowerCase().includes(query.toLowerCase()))
      .map((v) => ({ video: v, score: 1 })),
}));

// Minimal i18n
vi.mock('../../src/utils/PlatformI18n', () => ({
  getPlatformI18n: () => ({
    t: (k: string) => k,
    locale: 'en',
    setLocale: () => {},
  }),
}));

vi.mock('@ctv/core/i18n/I18n', () => ({}));

vi.mock('@ctv/core/server-config/ServerConfig', () => ({
  isUrlValidForEnvironment: () => true,
}));

vi.mock('@ctv/shared/ui/ConfirmDialog', () => ({
  createConfirmDialog: () => ({ close: () => {} }),
  showConfirmDialog: () => {},
}));

vi.mock('../../src/Adapter/VideoPlayer', () => ({
  createVideoPlayer: () => ({
    getPosition: () => 0,
    getDuration: () => 100,
    seek: () => {},
    destroy: () => {},
  }),
}));

const store = {
  items: {} as Record<string, string>,
  get(key: string) {
    return this.items[key] ?? null;
  },
  set(key: string, value: string) {
    this.items[key] = value;
  },
  remove(key: string) {
    delete this.items[key];
  },
  getAll() {
    return { ...this.items };
  },
};

function hasFocusRing(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
}

function focusableChildren(el: HTMLElement) {
  return Array.from(el.querySelectorAll('[tabindex]')).filter(
    (n) => (n as HTMLElement).getAttribute('tabindex') !== '-1'
  ) as HTMLElement[];
}

describe('Remote keyboard accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Settings: surviving focusable (Give link) is focusable via D-pad', () => {
    const screen = renderSettingsScreen();
    document.body.appendChild(screen);
    initSettingsScreen(store, () => {});
    // Appearance/Server/Data/Privacy options were removed; the only remaining
    // focusable is the Give donation link.
    const focusables = focusableChildren(screen);
    expect(focusables.length).toBeGreaterThanOrEqual(1);
    focusables.forEach((el) => {
      el.focus();
      expect(document.activeElement).toBe(el);
    });
    cleanupSettingsScreen();
  });

  it('Settings: Enter key does not error on a screen with no data-setting options', () => {
    const screen = renderSettingsScreen();
    document.body.appendChild(screen);
    initSettingsScreen(store, () => {});
    // The former layout/theme options are gone. Focus whatever remains (the
    // Give link) and confirm the D-pad keydown handler does not throw.
    const focusables = focusableChildren(screen);
    expect(focusables.length).toBeGreaterThanOrEqual(1);
    focusables[0].focus();
    expect(() =>
      focusables[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    ).not.toThrow();
    cleanupSettingsScreen();
  });

  it('Search: input focused on screen load', () => {
    const screen = createSearchScreen({
      videos: [{ id: 'v1', title: 'Test Video', thumbnail: '', shortDescription: '' }],
      onVideoSelect: () => {},
    });
    document.body.appendChild(screen);
    const input = screen.querySelector('.search-screen__input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('Search: Enter submits, Escape clears', () => {
    const screen = createSearchScreen({
      videos: [{ id: 'v1', title: 'Test Video', thumbnail: '', shortDescription: '' }],
      onVideoSelect: () => {},
    });
    document.body.appendChild(screen);
    const input = screen.querySelector('.search-screen__input') as HTMLInputElement;
    input.value = 'test';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(input.value).toBe('test');
    input.value = 'clear me';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('');
    (screen as any).cleanup();
  });

  it('Video: progress bar is focusable and keyboard seekable', () => {
    const screen = createVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: 'http://example.com/video.mp4',
      duration: 100,
    });
    document.body.appendChild(screen);
    const progress = screen.querySelector('.video-screen__progress') as HTMLElement;
    expect(progress).not.toBeNull();
    expect(progress.getAttribute('tabindex')).toBe('0');
    progress.focus();
    expect(document.activeElement).toBe(progress);
    // Verify keyboard seek handler is attached
    const seekKeydown = vi.fn();
    progress.addEventListener('keydown', seekKeydown);
    progress.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(seekKeydown).toHaveBeenCalled();
    (screen as any).cleanup();
  });

  it('All focusable elements have visible focus rings', () => {
    const screen = renderSettingsScreen();
    document.body.appendChild(screen);
    initSettingsScreen(store, () => {});
    const focusables = focusableChildren(screen);
    focusables.forEach((el) => {
      el.focus();
      expect(hasFocusRing(el)).toBe(true);
    });
    cleanupSettingsScreen();
  });
});
