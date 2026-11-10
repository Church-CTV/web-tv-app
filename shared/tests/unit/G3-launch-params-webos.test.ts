/**
 * G3 LaunchParams — webOS TV launch parameter tests.
 *
 * These used to stub `window.webOSTV = { launchParams: ... }` and pass, while the SDK
 * the app actually ships (`platforms/webos/public/vendor/webOSTV.js`, v1.2.13) never
 * creates a `webOSTV` global and exposes no launchParams member at all: it defines
 * `window.webOS` / `window.Mojo` and exports deviceInfo, fetchAppId, fetchAppInfo,
 * fetchAppRootPath, keyboard, libVersion, platform, platformBack, service,
 * systemInfo. That green suite was measuring a global of our own invention. The cases
 * below drive the surfaces LG documents instead - `webOSDev.launchParams()` for the
 * pull path and the `webOSLaunch` / `webOSRelaunch` document events for the push path.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  readWebOSLaunchParams,
  onWebOSLaunchParams,
  webOSLaunchParamsResult,
  type WebOSLaunchParams,
} from '@ctv/shared/ui/LaunchParams.webos';

type DevWindow = Window & { webOSDev?: { launchParams?: () => WebOSLaunchParams | null } };

function stubLaunchParams(params: WebOSLaunchParams | null): void {
  (window as DevWindow).webOSDev = { launchParams: () => params };
}

function dispatchLauncherEvent(type: 'webOSLaunch' | 'webOSRelaunch', detail: unknown): void {
  document.dispatchEvent(new CustomEvent(type, { detail }));
}

describe('LaunchParams.webos read path', () => {
  afterEach(() => {
    delete (window as DevWindow).webOSDev;
    delete (window as unknown as { webOSTV?: unknown }).webOSTV;
  });

  it('reports no deep link when no launcher bridge is present', () => {
    // The ordinary state of a TV with no webOSDev library: must not throw, and must
    // not invent a value.
    const result = readWebOSLaunchParams();
    expect(result).toEqual({ videoId: null, found: false });
  });

  it('reads contentId from webOSDev.launchParams()', () => {
    stubLaunchParams({ contentId: 'vid123' });
    expect(readWebOSLaunchParams()).toEqual({ videoId: 'vid123', found: true });
  });

  it('accepts the alternate videoId key', () => {
    stubLaunchParams({ videoId: 'vid456' });
    expect(readWebOSLaunchParams()).toEqual({ videoId: 'vid456', found: true });
  });

  it('accepts the fully-qualified key', () => {
    stubLaunchParams({ 'com.chroma.channel.contentId': 'vid789' });
    expect(readWebOSLaunchParams()).toEqual({ videoId: 'vid789', found: true });
  });

  it('prefers contentId over videoId when both are present', () => {
    stubLaunchParams({ contentId: 'content-vid', videoId: 'video-vid' });
    expect(readWebOSLaunchParams().videoId).toBe('content-vid');
  });

  it('ignores an empty or non-string value instead of deep-linking to nothing', () => {
    stubLaunchParams({ contentId: '' });
    expect(readWebOSLaunchParams().found).toBe(false);
    stubLaunchParams({ contentId: 42 });
    expect(readWebOSLaunchParams().found).toBe(false);
  });

  it('treats a null parameter object as no deep link', () => {
    stubLaunchParams(null);
    expect(readWebOSLaunchParams().found).toBe(false);
  });

  it('survives a launcher bridge that throws', () => {
    (window as DevWindow).webOSDev = {
      launchParams: () => {
        throw new Error('wrong context');
      },
    };
    expect(readWebOSLaunchParams().found).toBe(false);
  });

  it('does not treat the invented webOSTV global as a source any more', () => {
    // Regression lock for the original defect: this shape used to satisfy both the
    // reader and its test, although nothing in the shipped bundle creates it.
    (window as unknown as { webOSTV?: { launchParams: WebOSLaunchParams } }).webOSTV = {
      launchParams: { contentId: 'invented' },
    };
    expect(readWebOSLaunchParams()).toEqual({ videoId: null, found: false });
  });
});

describe('LaunchParams.webos event path', () => {
  it('delivers the parameters carried by webOSRelaunch', () => {
    // A TV suspends apps rather than closing them, so a deep link usually arrives as
    // a re-launch on the running instance.
    const seen: WebOSLaunchParams[] = [];
    const off = onWebOSLaunchParams((params) => seen.push(params));
    dispatchLauncherEvent('webOSRelaunch', { contentId: 'relaunched' });
    off();
    expect(seen).toEqual([{ contentId: 'relaunched' }]);
    expect(webOSLaunchParamsResult(seen[0])).toEqual({ videoId: 'relaunched', found: true });
  });

  it('delivers the parameters carried by webOSLaunch', () => {
    const seen: WebOSLaunchParams[] = [];
    const off = onWebOSLaunchParams((params) => seen.push(params));
    dispatchLauncherEvent('webOSLaunch', { videoId: 'fresh' });
    off();
    expect(seen).toEqual([{ videoId: 'fresh' }]);
  });

  it('ignores an event with no usable detail', () => {
    const seen: WebOSLaunchParams[] = [];
    const off = onWebOSLaunchParams((params) => seen.push(params));
    document.dispatchEvent(new Event('webOSRelaunch'));
    dispatchLauncherEvent('webOSRelaunch', 'not-an-object');
    off();
    expect(seen).toEqual([]);
  });

  it('stops delivering after unsubscribe', () => {
    const seen: WebOSLaunchParams[] = [];
    const off = onWebOSLaunchParams((params) => seen.push(params));
    dispatchLauncherEvent('webOSRelaunch', { contentId: 'first' });
    off();
    dispatchLauncherEvent('webOSRelaunch', { contentId: 'second' });
    expect(seen.map((p) => p.contentId)).toEqual(['first']);
  });
});
