/**
 * Samsung screensaver control — unit tests.
 *
 * Samsung's mandatory-feature rule is explicit: the screensaver must be off while video
 * plays and back on when playback is paused or stopped (`setting-screensaver` guide,
 * mandatory-features MF-04/MF-05). The API only exists on a TV after
 * `$WEBAPIS/webapis/webapis.js` loads, so the off-TV path has to be a silent no-op
 * rather than a throw — a browser run and the e2e suite must stay clean.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  SAMSUNG_WEBAPIS_SCRIPT,
  createScreenSaverControl,
  loadSamsungWebApis,
} from '../../src/Adapter/ScreenSaver';

type FakeAppCommon = {
  SCREEN_SAVER_OFF: number;
  SCREEN_SAVER_ON: number;
  setScreenSaver: ReturnType<typeof vi.fn>;
};

function winWith(appcommon: FakeAppCommon | null): Window {
  const w = { webapis: appcommon ? { appcommon } : undefined } as unknown as Window;
  return w;
}

describe('loadSamsungWebApis', () => {
  it('injects the Samsung webapis script on a TV (window.tizen present)', () => {
    const appended: HTMLScriptElement[] = [];
    const doc = {
      createElement: () => {
        const el = document.createElement('script');
        appended.push(el);
        return el;
      },
      head: document.createElement('head'),
      querySelector: () => null,
    } as unknown as Document;
    const loaded = loadSamsungWebApis(doc, { tizen: {} } as unknown as Window);
    expect(loaded).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.src).toContain(SAMSUNG_WEBAPIS_SCRIPT);
  });

  it('does nothing off a TV, so a browser run never 404s on $WEBAPIS', () => {
    const appended: HTMLScriptElement[] = [];
    const doc = {
      createElement: () => {
        const el = document.createElement('script');
        appended.push(el);
        return el;
      },
      head: document.createElement('head'),
      querySelector: () => null,
    } as unknown as Document;
    const loaded = loadSamsungWebApis(doc, {} as Window);
    expect(loaded).toBe(false);
    expect(appended).toHaveLength(0);
  });

  it('injects at most once per document', () => {
    const head = document.createElement('head');
    const existing = document.createElement('script');
    existing.src = SAMSUNG_WEBAPIS_SCRIPT;
    head.appendChild(existing);
    const appended: HTMLScriptElement[] = [];
    const doc = {
      createElement: () => {
        const el = document.createElement('script');
        appended.push(el);
        return el;
      },
      head,
      querySelector: () => existing,
    } as unknown as Document;
    expect(loadSamsungWebApis(doc, { tizen: {} } as unknown as Window)).toBe(true);
    expect(appended).toHaveLength(0);
  });
});

describe('createScreenSaverControl', () => {
  it('turns the screensaver OFF (SCREEN_SAVER_OFF) when asked to keep the screen awake', () => {
    const setScreenSaver = vi.fn();
    const ctl = createScreenSaverControl(
      winWith({ SCREEN_SAVER_OFF: 0, SCREEN_SAVER_ON: 1, setScreenSaver })
    );
    expect(ctl.keepAwake(true)).toBe(true);
    expect(setScreenSaver).toHaveBeenCalledTimes(1);
    expect(setScreenSaver.mock.calls[0]?.[0]).toBe(0);
    expect(typeof setScreenSaver.mock.calls[0]?.[1]).toBe('function');
  });

  it('turns the screensaver back ON (SCREEN_SAVER_ON) when playback stops needing it', () => {
    const setScreenSaver = vi.fn();
    const ctl = createScreenSaverControl(
      winWith({ SCREEN_SAVER_OFF: 0, SCREEN_SAVER_ON: 1, setScreenSaver })
    );
    ctl.keepAwake(true);
    ctl.keepAwake(false);
    expect(setScreenSaver).toHaveBeenCalledTimes(2);
    expect(setScreenSaver.mock.calls[1]?.[0]).toBe(1);
  });

  it('does not repeat the same state to the platform', () => {
    const setScreenSaver = vi.fn();
    const ctl = createScreenSaverControl(
      winWith({ SCREEN_SAVER_OFF: 0, SCREEN_SAVER_ON: 1, setScreenSaver })
    );
    ctl.keepAwake(true);
    ctl.keepAwake(true);
    expect(setScreenSaver).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the platform API is missing, and says so', () => {
    const ctl = createScreenSaverControl(winWith(null));
    expect(ctl.supported()).toBe(false);
    expect(ctl.keepAwake(true)).toBe(false);
    expect(ctl.keepAwake(false)).toBe(false);
  });

  it('survives a platform error callback instead of breaking playback', () => {
    const setScreenSaver = (_state: number, _ok: () => void, fail: (e: unknown) => void) => {
      fail(new Error('appcommon denied'));
    };
    const ctl = createScreenSaverControl(
      winWith({ SCREEN_SAVER_OFF: 0, SCREEN_SAVER_ON: 1, setScreenSaver: setScreenSaver as never })
    );
    expect(() => ctl.keepAwake(true)).not.toThrow();
  });

  it('reports unsupported when the TV exposes the API under different constants', () => {
    const ctl = createScreenSaverControl(
      winWith({ setScreenSaver: vi.fn() } as unknown as FakeAppCommon)
    );
    expect(ctl.supported()).toBe(false);
  });
});

afterEach(() => {
  delete (window as unknown as { webapis?: unknown }).webapis;
});
