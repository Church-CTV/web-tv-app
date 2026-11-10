/**
 * Vizio Watch-Later Button — unit tests (TDD).
 *
 * Closes the real gap where Vizio had NO watch-later handler: the video screen
 * rendered with no way to add a video to Watch Later. This wires a button onto
 * the video screen (matching webOS and Tizen).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { attachWatchLaterButton, __setPlatformStorageForTest } from '../../src/App';
import { getWatchLater, getWatchLaterCount } from '@ctv/core/watch-later/WatchLater';

/** In-memory store implementing the WatchLaterStore contract. */
function makeStorage() {
  const map = new Map<string, string>();
  return {
    get: (k: string) => (map.has(k) ? map.get(k)! : null),
    set: (k: string, v: string) => void map.set(k, v),
    remove: (k: string) => void map.delete(k),
    getAll: () => Object.fromEntries(map),
  };
}

describe('Vizio Watch-Later button', () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    localStorage.clear();
    storage = makeStorage();
    __setPlatformStorageForTest(storage);
    document.body.innerHTML = '<div id="screen-video"><video id="video-player"></video></div>';
  });

  it('attachWatchLaterButton renders a visible Watch-Later button on the video screen', () => {
    const btn = attachWatchLaterButton('vid-1', 'Cool Movie');

    expect(btn).toBeTruthy();
    expect(btn?.id).toBe('btn-watch-later-video');
    expect(btn?.textContent).toContain('Watch Later');
    expect(document.getElementById('btn-watch-later-video')).toBe(btn);
    expect(btn?.getAttribute('aria-label')).toBe('Add to Watch Later');
  });

  it('clicking the button saves the video to the watch-later queue', () => {
    expect(getWatchLaterCount(storage)).toBe(0);

    const btn = attachWatchLaterButton('vid-1', 'Cool Movie');
    btn?.click();

    const items = getWatchLater(storage);
    expect(items.length).toBe(1);
    expect(items[0].videoId).toBe('vid-1');
    expect(items[0].title).toBe('Cool Movie');
  });

  it('re-attaching for a new video replaces the stale button (no duplicates)', () => {
    attachWatchLaterButton('vid-1', 'Movie A');
    attachWatchLaterButton('vid-2', 'Movie B');

    const all = document.querySelectorAll('#btn-watch-later-video');
    expect(all.length).toBe(1);

    all[0].click();
    const items = getWatchLater(storage);
    expect(items.length).toBe(1);
    expect(items[0].videoId).toBe('vid-2');
  });

  it('returns null and does not throw when the video screen is missing', () => {
    document.body.innerHTML = '<div id="other"></div>';

    expect(() => attachWatchLaterButton('vid-1', 'Cool Movie')).not.toThrow();
    expect(attachWatchLaterButton('vid-1', 'Cool Movie')).toBeNull();
  });
});
