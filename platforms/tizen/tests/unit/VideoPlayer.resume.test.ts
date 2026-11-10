/**
 * Tizen VideoPlayer — continue-watching (Samsung MF-09).
 *
 * The adapter owns the resume behaviour because it is the only place that sees
 * `loadedmetadata`, `timeupdate`, `ended` and `stop()`. These tests drive those
 * events directly, which is also how a real television produces them: out of
 * order, more than once, and with a duration that only exists after metadata.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createVideoPlayer } from '../../src/Adapter/VideoPlayer';
import { RESUME_KEY_PREFIX, loadResumePoint, type ResumeStore } from '@ctv/shared/ui/Resume';

interface FakeMedia {
  element: HTMLVideoElement;
  /** Rewire the geometry a real element would have once metadata arrived. */
  setGeometry: (currentTime: number, duration: number) => void;
}

function media(): FakeMedia {
  const element = document.createElement('video');
  let currentTime = 0;
  let duration = Number.NaN;
  Object.defineProperty(element, 'play', { value: () => Promise.resolve(), configurable: true });
  Object.defineProperty(element, 'currentTime', {
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v;
    },
    configurable: true,
  });
  Object.defineProperty(element, 'duration', {
    get: () => duration,
    configurable: true,
  });
  document.body.appendChild(element);
  return {
    element,
    setGeometry: (t, d) => {
      currentTime = t;
      duration = d;
    },
  };
}

function memoryStore(initial: Record<string, string> = {}): ResumeStore & {
  reads: number;
  writes: number;
  raw: () => Record<string, string>;
} {
  const data = new Map(Object.entries(initial));
  const store = {
    reads: 0,
    writes: 0,
    get: (key: string) => {
      store.reads += 1;
      return data.get(key) ?? null;
    },
    set: (key: string, value: string) => {
      store.writes += 1;
      data.set(key, value);
    },
    remove: (key: string) => void data.delete(key),
    raw: () => Object.fromEntries(data),
  };
  return store;
}

const ID = 'sermon-12';
const keyOf = (id: string) => `${RESUME_KEY_PREFIX}${id}`;

describe('continue-watching (MF-09)', () => {
  let fake: FakeMedia;
  let store: ReturnType<typeof memoryStore>;
  let player: ReturnType<typeof createVideoPlayer>;
  let currentId: string | null;

  beforeEach(() => {
    fake = media();
    store = memoryStore();
    currentId = ID;
    vi.useFakeTimers();
  });

  afterEach(() => {
    player?.destroy();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  function attach(): void {
    player = createVideoPlayer(fake.element, { storage: store, videoId: () => currentId });
  }

  it('seeks to the stored position once the duration is known', () => {
    store.set(
      keyOf(ID),
      JSON.stringify({ videoId: ID, position: 420, duration: 1200, savedAt: Date.now() })
    );
    attach();
    player.play('/stream/a.mp4');

    // The seek cannot happen before the firmware reports the duration, or the
    // element clamps it to zero and the viewer watches from the top anyway.
    expect(fake.element.currentTime).toBe(0);
    fake.setGeometry(0, 1200);
    fake.element.dispatchEvent(new Event('loadedmetadata'));

    expect(fake.element.currentTime).toBe(420);
    expect(player.getResumePoint()?.position).toBe(420);
  });

  it('starts from zero when there is no stored position', () => {
    attach();
    player.play('/stream/a.mp4');
    fake.setGeometry(0, 1200);
    fake.element.dispatchEvent(new Event('loadedmetadata'));

    expect(fake.element.currentTime).toBe(0);
    expect(player.getResumePoint()).toBeNull();
  });

  it('writes the position while playing, no more often than the interval', () => {
    attach();
    fake.setGeometry(0, 1200);
    player.play('/stream/a.mp4');
    player.play('/stream/a.mp4');
    fake.element.dispatchEvent(new Event('playing'));

    const updates = (positions: number[]) => {
      for (const t of positions) {
        fake.setGeometry(t, 1200);
        fake.element.dispatchEvent(new Event('timeupdate'));
      }
    };
    updates([1, 2, 3]);
    expect(store.writes).toBe(0); // first seconds are not a resume point
    updates([30, 32, 34, 60]);
    expect(store.writes).toBe(2); // 0:30 and 1:00, not every tick
    const point = loadResumePoint(store, ID);
    expect(point?.position).toBe(60);
  });

  it('writes when playback stops, before the source is cleared', () => {
    attach();
    fake.setGeometry(200, 1200);
    player.play('/stream/a.mp4');
    fake.element.dispatchEvent(new Event('playing'));

    player.stop();
    expect(store.raw()[keyOf(ID)]).toBeDefined();
    expect(loadResumePoint(store, ID)?.position).toBe(200);
  });

  it('forgets the point when the programme ends', () => {
    store.set(
      keyOf(ID),
      JSON.stringify({ videoId: ID, position: 1190, duration: 1200, savedAt: Date.now() })
    );
    attach();
    fake.setGeometry(1199, 1200);
    player.play('/stream/a.mp4');
    fake.element.dispatchEvent(new Event('ended'));

    expect(store.raw()[keyOf(ID)]).toBeUndefined();
  });

  it('never stores a position for a live stream', () => {
    attach();
    player.play('/live/a.m3u8');
    fake.setGeometry(600, Number.POSITIVE_INFINITY);
    fake.element.dispatchEvent(new Event('playing'));
    fake.element.dispatchEvent(new Event('timeupdate'));
    player.stop();

    expect(store.raw()).toEqual({});
  });

  it('does not read the store at all when resume is not configured', () => {
    player = createVideoPlayer(fake.element);
    fake.setGeometry(300, 1200);
    player.play('/stream/a.mp4');
    fake.element.dispatchEvent(new Event('playing'));
    fake.element.dispatchEvent(new Event('timeupdate'));
    player.stop();

    expect(store.reads).toBe(0);
    expect(store.writes).toBe(0);
  });

  it('keeps working when the programme identity is unknown', () => {
    currentId = null;
    attach();
    fake.setGeometry(300, 1200);
    player.play('/stream/a.mp4');
    fake.element.dispatchEvent(new Event('playing'));
    fake.element.dispatchEvent(new Event('timeupdate'));
    expect(() => player.stop()).not.toThrow();
    expect(store.raw()).toEqual({});
  });
});
