/**
 * Resume rules, tested where they live (shared), so no platform re-decides them.
 *
 * Every case here is a defect that was worth naming: resuming a live stream,
 * advertising a restart at 0:02, replaying the outro at the very end, seeking
 * past a re-encoded file, and dragging a viewer back to a programme they walked
 * away from months ago.
 */

import { describe, expect, it } from 'vitest';
import {
  RESUME_KEY_PREFIX,
  RESUME_RETENTION_DAYS,
  clearResumePoint,
  formatResumeTime,
  isResumable,
  loadResumePoint,
  resumeKey,
  saveResumePoint,
  type ResumeStore,
} from '../../ui/Resume';

function memoryStore(
  initial: Record<string, string> = {}
): ResumeStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  };
}

describe('isResumable', () => {
  it('refuses live content, where there is nowhere to resume to', () => {
    expect(isResumable(600, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isResumable(600, Number.NaN)).toBe(false);
  });

  it('refuses the first seconds, which would advertise a restart', () => {
    expect(isResumable(0, 1000)).toBe(false);
    expect(isResumable(14, 1000)).toBe(false);
    expect(isResumable(15, 1000)).toBe(true);
  });

  it('refuses the last seconds, which would replay the outro', () => {
    expect(isResumable(995, 1000)).toBe(false);
    expect(isResumable(989, 1000)).toBe(true);
  });

  it('refuses nonsense positions', () => {
    expect(isResumable(-5, 1000)).toBe(false);
    expect(isResumable(100, 0)).toBe(false);
  });
});

describe('saveResumePoint / loadResumePoint', () => {
  it('writes under the namespaced key and reads it back', () => {
    const store = memoryStore();
    expect(saveResumePoint(store, 'sermon-12', 300, 1200, 1_000)).toBe(true);
    expect(Object.keys(store.dump())).toEqual([`${RESUME_KEY_PREFIX}sermon-12`]);
    expect(resumeKey('sermon-12')).toBe(`${RESUME_KEY_PREFIX}sermon-12`);

    expect(loadResumePoint(store, 'sermon-12', 1_000)).toEqual({
      videoId: 'sermon-12',
      position: 300,
      duration: 1200,
      savedAt: 1_000,
    });
  });

  it('writes nothing for a position that is not worth remembering', () => {
    const store = memoryStore();
    expect(saveResumePoint(store, 'a', 5, 1200, 1_000)).toBe(false);
    expect(saveResumePoint(store, 'a', 1198, 1200, 1_000)).toBe(false);
    expect(saveResumePoint(store, 'a', 300, Number.POSITIVE_INFINITY, 1_000)).toBe(false);
    expect(store.dump()).toEqual({});
  });

  it('survives a store that cannot be written, and keeps playing', () => {
    const exploding: ResumeStore = {
      get: () => null,
      set: () => {
        throw new Error('quota');
      },
      remove: () => {},
    };
    expect(saveResumePoint(exploding, 'a', 300, 1200)).toBe(false);
  });

  it('survives a store that cannot be read', () => {
    const exploding: ResumeStore = {
      get: () => {
        throw new Error('unavailable');
      },
      set: () => {},
      remove: () => {},
    };
    expect(loadResumePoint(exploding, 'a')).toBeNull();
  });

  it('ignores a corrupt entry instead of seeking to NaN', () => {
    const store = memoryStore({ [`${RESUME_KEY_PREFIX}a`]: '{not json' });
    expect(loadResumePoint(store, 'a')).toBeNull();
  });

  it('ignores an entry that belongs to another programme', () => {
    const store = memoryStore();
    saveResumePoint(store, 'a', 300, 1200, 1_000);
    expect(loadResumePoint(store, 'b', 1_000)).toBeNull();
  });

  it('drops a point older than the retention window', () => {
    const store = memoryStore();
    const day = 24 * 60 * 60 * 1000;
    saveResumePoint(store, 'a', 300, 1200, 0);
    expect(loadResumePoint(store, 'a', (RESUME_RETENTION_DAYS - 1) * day)).not.toBeNull();
    expect(loadResumePoint(store, 'a', (RESUME_RETENTION_DAYS + 1) * day)).toBeNull();
  });

  it('clamps a point that no longer fits the file on the server', () => {
    const store = memoryStore({
      [`${RESUME_KEY_PREFIX}a`]: JSON.stringify({
        videoId: 'a',
        position: 1500,
        duration: 1500,
        savedAt: 1_000,
      }),
    });
    const point = loadResumePoint(store, 'a', 1_000);
    expect(point).not.toBeNull();
    expect(point!.position).toBeLessThan(1500);
  });

  it('forgets on request', () => {
    const store = memoryStore();
    saveResumePoint(store, 'a', 300, 1200, 1_000);
    clearResumePoint(store, 'a');
    expect(loadResumePoint(store, 'a', 1_000)).toBeNull();
  });
});

describe('formatResumeTime', () => {
  it('formats the way the banner reads it', () => {
    expect(formatResumeTime(0)).toBe('0:00');
    expect(formatResumeTime(65)).toBe('1:05');
    expect(formatResumeTime(3725)).toBe('1:02:05');
    expect(formatResumeTime(Number.NaN)).toBe('0:00');
  });
});
