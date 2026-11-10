/**
 * LaunchParams — webOS TV launch parameter reader.
 *
 * The contract below is taken from LG's own documentation, not inferred from the
 * SDK we ship:
 *  - "App Lifecycle Management": webOS TV raises a `webOSLaunch` event to launch the
 *    app and a `webOSRelaunch` event when an already-running app is launched again,
 *    and "the added event listener receives an event parameter that holds launch
 *    parameters" (`inData.detail`). LG's sample registers both on `document` with the
 *    capture flag set to `true`.
 *  - "webOSDev API": `webOSDev.launchParams()` returns the "parameters of an app
 *    launched by the webOSDev.launch method", with the note that they "usually"
 *    arrive on those events and "this method can be used to get the parameters from
 *    elsewhere where those events don't occur".
 *
 * Both surfaces belong to webOSTV-dev.js (the webOSDev API), which this app does not
 * vendor. `platforms/webos/public/vendor/webOSTV.js` (v1.2.13) defines `window.webOS`
 * and `window.Mojo` and exports deviceInfo, fetchAppId, fetchAppInfo,
 * fetchAppRootPath, keyboard, libVersion, platform, platformBack, service and
 * systemInfo — there is no launchParams member anywhere in it. The previous reader
 * read `window.webOSTV.launchParams`, a global nothing in the shipped bundle ever
 * creates, so a deep link on a real TV always resolved to "no parameters" while the
 * unit test stayed green on a hand-stubbed `window.webOSTV`.
 *
 * Every access here is feature-detected, so a TV without the dev library simply
 * reports `{ found: false }` and the caller falls back to the hash/query deep link.
 *
 * Residual UNKNOWN, tracked in the publish ledger: which surface a given LG model
 * populates, and whether those events reach a DOM app without webOSTV-dev.js loaded.
 * That needs a real-TV / `ares-launch` smoke test; CI cannot answer it.
 *
 * G3: Platform launch-parameter deep links for webOS.
 */

import type { LaunchParamsResult } from './LaunchParams.tizen';

/** The parameter object the launcher hands over, in whatever shape it arrives. */
export type WebOSLaunchParams = Record<string, unknown>;

type WebOSWindow = Window & {
  webOSDev?: { launchParams?: () => WebOSLaunchParams | null | undefined };
};

/** Key precedence is part of the deep-link contract: canonical key first. */
const CONTENT_ID_KEYS = ['contentId', 'videoId', 'com.chroma.channel.contentId'] as const;

function pickContentId(params: unknown): string | null {
  if (!params || typeof params !== 'object') return null;
  const record = params as Record<string, unknown>;
  for (const key of CONTENT_ID_KEYS) {
    const val = record[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return null;
}

/** Shape a set of launch parameters into the deep-link result type. */
export function webOSLaunchParamsResult(params: unknown): LaunchParamsResult {
  const videoId = pickContentId(params);
  return videoId ? { videoId, found: true } : { videoId: null, found: false };
}

/**
 * Pull the launch parameters for the current run. Returns `{ found: false }` when no
 * launcher supplied any, including the normal case of a TV that has no webOSDev
 * library loaded, and when the SDK call throws for a context reason.
 */
export function readWebOSLaunchParams(): LaunchParamsResult {
  const dev = (window as WebOSWindow).webOSDev;
  if (dev && typeof dev.launchParams === 'function') {
    try {
      return webOSLaunchParamsResult(dev.launchParams());
    } catch {
      // A launcher bridge that throws must not take the deep link (or startup) down;
      // parseDeepLink also falls back to URL parsing if we report nothing.
      return { videoId: null, found: false };
    }
  }
  return { videoId: null, found: false };
}

/**
 * Subscribe to launcher hand-offs that arrive while the app is already running.
 *
 * This is the case that actually happens on a TV: webOS suspends apps instead of
 * terminating them, so opening content from the launcher or another app usually
 * raises `webOSRelaunch` on the live instance rather than starting a new one. A
 * startup-only read therefore misses most deep links.
 *
 * Returns an unsubscribe function, because an app object that is re-initialised in
 * tests must not stack listeners on the shared document.
 */
export function onWebOSLaunchParams(handler: (params: WebOSLaunchParams) => void): () => void {
  const handle = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (detail && typeof detail === 'object') handler(detail as WebOSLaunchParams);
  };
  // `document` + capture `true` is how LG's own sample registers these.
  document.addEventListener('webOSLaunch', handle, true);
  document.addEventListener('webOSRelaunch', handle, true);
  return () => {
    document.removeEventListener('webOSLaunch', handle, true);
    document.removeEventListener('webOSRelaunch', handle, true);
  };
}
