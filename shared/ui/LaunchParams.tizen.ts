/**
 * LaunchParams — Tizen TV launch parameter reader.
 *
 * On Samsung Tizen TVs, the launcher passes an AppControl to the app.
 * The AppControl has a `payload` string (often JSON) and a `type`.
 *
 * G3: Platform launch-parameter deep links for Tizen.
 */

export interface AppControlPayload {
  contentId?: string;
  videoId?: string;
  [key: string]: unknown;
}

export interface TizenAppControl {
  payload?: string;
  type?: string;
  operation?: string;
}

export interface LaunchParamsResult {
  videoId: string | null;
  found: boolean;
}

/**
 * Parse the Tizen AppControl payload string (JSON) and extract the content ID.
 * Returns `{ videoId: null, found: false }` when no AppControl is present
 * or no recognized key is set.
 *
 * Accepts an `appControl` parameter (dependency injection) so tests can
 * supply a mock without touching the global Tizen SDK.
 */
export function readTizenLaunchParams(
  appControl: TizenAppControl | null | undefined
): LaunchParamsResult {
  if (!appControl || !appControl.payload) {
    return { videoId: null, found: false };
  }

  const payloadStr = appControl.payload.trim();
  if (!payloadStr) return { videoId: null, found: false };

  let payload: AppControlPayload;
  try {
    payload = JSON.parse(payloadStr) as AppControlPayload;
  } catch {
    // Payload is not JSON - treat it as a raw content ID
    return { videoId: payloadStr, found: true };
  }

  if (typeof payload.contentId === 'string' && payload.contentId.length > 0) {
    return { videoId: payload.contentId, found: true };
  }
  if (typeof payload.videoId === 'string' && payload.videoId.length > 0) {
    return { videoId: payload.videoId, found: true };
  }

  return { videoId: null, found: false };
}

/**
 * Read the AppControl from the global Tizen SDK.
 * Returns null when the SDK is not present.
 */
export function getTizenAppControl(): TizenAppControl | null {
  const win = window as unknown as {
    tizen?: {
      application?: {
        getRequestedAppControl?(): TizenAppControl | undefined;
      };
    };
  };
  const fn = win.tizen?.application?.getRequestedAppControl;
  if (typeof fn !== 'function') return null;
  return fn.call(win.tizen?.application) ?? null;
}
