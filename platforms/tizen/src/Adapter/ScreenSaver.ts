/**
 * Samsung screensaver control (Tizen).
 *
 * Samsung states it twice: the mandatory-features list requires the screensaver to be
 * disabled while a video or slideshow plays and re-enabled when playback is paused or
 * stopped, and the `setting-screensaver` guide names the API
 * (`webapis.appcommon.setScreenSaver`). The webOS and Vizio adapters deliberately do not
 * carry this: those platforms expose no such call.
 *
 * Two facts make this awkward, and both are handled here rather than at the call sites:
 *  - `window.webapis` only exists after `$WEBAPIS/webapis/webapis.js` has been served by
 *    the TV. That path resolves on a television and 404s in a browser, so the script is
 *    injected at runtime only when `window.tizen` is present, and the e2e/browser runs
 *    stay clean.
 *  - The platform state constants are read from the device, never assumed: if a firmware
 *    build does not publish `SCREEN_SAVER_OFF`/`SCREEN_SAVER_ON`, the control reports
 *    `supported() === false` instead of guessing numbers.
 */

export const SAMSUNG_WEBAPIS_SCRIPT = '$WEBAPIS/webapis/webapis.js';

// `window.tizen` is deliberately not re-declared here: RemoteControl.ts already types it
// with the tvinputdevice/keys surface, and a second declaration would narrow it.
declare global {
  interface Window {
    webapis?: {
      appcommon?: {
        SCREEN_SAVER_OFF?: number;
        SCREEN_SAVER_ON?: number;
        setScreenSaver?: (
          state: number,
          successCallback?: () => void,
          errorCallback?: (error: unknown) => void
        ) => void;
      };
    };
  }
}

type AppCommon = NonNullable<NonNullable<Window['webapis']>['appcommon']>;

/** The AppCommon surface once every member the policy needs is actually present. */
type AppCommonReady = {
  SCREEN_SAVER_OFF: number;
  SCREEN_SAVER_ON: number;
  setScreenSaver: NonNullable<AppCommon['setScreenSaver']>;
};

/** True on a Tizen TV, where the TV serves $WEBAPIS. */
function isTizenTelevision(win: Window | null | undefined): boolean {
  return (win as { tizen?: unknown } | null | undefined)?.tizen !== undefined;
}

/**
 * Ask the TV to serve its Web API layer. Returns false (and touches nothing) when this
 * is not a Tizen TV, so a browser run never requests an unservable `$WEBAPIS/...` path.
 */
export function loadSamsungWebApis(
  doc: Document = document,
  win: Window | null = typeof window === 'undefined' ? null : window
): boolean {
  if (!isTizenTelevision(win)) return false;
  if (doc.querySelector('script[data-samsung-webapis], script[src*="webapis/webapis.js"]'))
    return true;
  const script = doc.createElement('script');
  script.src = SAMSUNG_WEBAPIS_SCRIPT;
  script.dataset.samsungWebapis = '1';
  doc.head.appendChild(script);
  return true;
}

export interface ScreenSaverControl {
  /** true when the platform call was made for this request. */
  keepAwake(awake: boolean): boolean;
  /** true when this device actually exposes the AppCommon screensaver API. */
  supported(): boolean;
}

function appCommonOf(win: Window | null | undefined): AppCommonReady | null {
  const api = win?.webapis?.appcommon;
  if (!api) return null;
  if (typeof api.SCREEN_SAVER_OFF !== 'number' || typeof api.SCREEN_SAVER_ON !== 'number')
    return null;
  if (typeof api.setScreenSaver !== 'function') return null;
  return api as AppCommonReady;
}

/**
 * Screensaver policy owner. Every call is idempotent per state: the platform is only
 * touched when the requested state actually changes, and a platform rejection clears the
 * remembered state so the next request retries instead of being swallowed.
 */
export function createScreenSaverControl(
  win: Window | null | undefined = typeof window === 'undefined' ? null : window
): ScreenSaverControl {
  let last: boolean | null = null;

  return {
    supported(): boolean {
      return appCommonOf(win) !== null;
    },
    keepAwake(awake: boolean): boolean {
      const api = appCommonOf(win);
      if (!api) {
        last = null;
        return false;
      }
      if (last === awake) return true;
      last = awake;
      try {
        api.setScreenSaver(
          awake ? api.SCREEN_SAVER_OFF : api.SCREEN_SAVER_ON,
          () => undefined,
          () => {
            // The TV refused: forget the state so the next transition tries again, but
            // never let a screensaver refusal reach playback.
            last = null;
          }
        );
      } catch {
        last = null;
        return false;
      }
      return true;
    },
  };
}
