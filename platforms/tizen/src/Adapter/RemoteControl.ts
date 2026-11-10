/**
 * Tizen Remote Control Adapter.
 * Uses DOM navigation on modern Tizen and browsers, with legacy tizen.keys
 * callbacks when tvinputdevice is unavailable. Registers optional media keys
 * through the official tvinputdevice API (tv.inputdevice privilege).
 *
 * Every key registered via registerlockevent is matched by a releasekeyevent
 * on teardown AND on beforeunload, so the TV does not keep swallowing keys
 * after the app exits (a store-review check; config.xml enables hwkey-event).
 */

// Minimal type declaration for the Tizen runtime global (avoids @types/tizen).
// We read it via `window.tizen` so tests can stub it on the global object.
declare global {
  interface Window {
    tizen?: {
      tvinputdevice?: {
        registerKey(key: string): void;
        unregisterKey(key: string): void;
      };
      keys?: {
        registerlockevent(keycode: string, callback: () => void): void;
        releasekeyevent?(keycode: string, callback: () => void): void;
      };
      application?: {
        getCurrentApplication?(): { exit?(): void } | undefined;
      };
    };
  }
}

/**
 * Exit the application through the Tizen Application API (Since 1.0, no
 * privilege required). At the root view the app must exit itself —
 * the Samsung launch checklist expects back-at-root to close the app.
 * Guarded: a no-op in browsers/E2E where window.tizen is absent.
 */
export function exitApplication(): void {
  try {
    window.tizen?.application?.getCurrentApplication?.()?.exit?.();
  } catch {
    // Non-Tizen runtimes: never throw out of a key handler.
  }
}

export type TizenKey = 'up' | 'down' | 'left' | 'right' | 'enter' | 'back' | 'menu';

export interface RemoteControlHandler {
  (key: TizenKey): void;
}

// ---- Tizen key-lock bookkeeping (module scope) -----------------------------
// Every registerlockevent call is recorded here so a single persistent
// beforeunload handler can release every lock regardless of how many adapters
// were created. Leftover locks make the TV keep swallowing keys after the app
// exits, which store reviewers flag.
type LockedKey = { keycode: string; callback: () => void };
const lockedKeys: LockedKey[] = [];
let unloadHandlerInstalled = false;

function releaseLockedKey(entry: LockedKey): void {
  const keys = window.tizen?.keys;
  if (!keys) return;
  const release = keys.releasekeyevent;
  if (typeof release !== 'function') return; // graceful no-op if the runtime lacks it
  try {
    release(entry.keycode, entry.callback);
  } catch {
    // A failed release must not throw out of teardown.
  }
}

function releaseAllLockedKeys(): void {
  for (const entry of lockedKeys) releaseLockedKey(entry);
  lockedKeys.length = 0;
}

// Install ONE persistent beforeunload handler (idempotent: releaseAllLockedKeys
// clears the queue, so repeated unloads are no-ops). Not `{ once }` so the
// handler survives if the app registers more keys after an early unload.
function ensureUnloadHandler(): void {
  if (unloadHandlerInstalled) return;
  unloadHandlerInstalled = true;
  window.addEventListener('beforeunload', releaseAllLockedKeys);
}

export function createRemoteControl(handler: RemoteControlHandler, onBack?: () => void) {
  const input = window.tizen?.tvinputdevice;
  const registered: string[] = [];
  const releaseMediaKeys = (): void => {
    for (const key of registered.splice(0)) {
      try {
        input?.unregisterKey(key);
      } catch {
        continue;
      }
    }
  };
  if (input) {
    for (const key of [
      'MediaPlayPause',
      'MediaPlay',
      'MediaPause',
      'MediaStop',
      'MediaFastForward',
      'MediaRewind',
    ]) {
      try {
        input.registerKey(key);
        registered.push(key);
      } catch {
        continue;
      }
    }
    window.addEventListener('beforeunload', releaseMediaKeys);
  }
  const KEY_MAP: Record<string, TizenKey> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'enter',
    Escape: 'back',
    Back: 'back',
    Backspace: 'back',
    Menu: 'menu',
  };

  // (Tizen keycode, mapped key) pairs to lock with the tizen.keys API.
  const lockDefs: Array<{ keycode: string; mapped: TizenKey }> = [
    { keycode: 'KEY_UP', mapped: 'up' },
    { keycode: 'KEY_DOWN', mapped: 'down' },
    { keycode: 'KEY_LEFT', mapped: 'left' },
    { keycode: 'KEY_RIGHT', mapped: 'right' },
    { keycode: 'KEY_ENTER', mapped: 'enter' },
    { keycode: 'KEY_BACK', mapped: 'back' },
    { keycode: 'KEY_MENU', mapped: 'menu' },
  ];

  // The exact callback refs we register with, reused verbatim on release.
  const localLocks: LockedKey[] = [];
  const tizenKeys = window.tizen?.keys;
  // Base navigation keys are delivered as DOM events on modern Tizen; locking
  // them as well can deliver the same physical press through both sources.
  if (tizenKeys && !input) {
    ensureUnloadHandler();
    for (const def of lockDefs) {
      const callback = (): void => {
        if (def.mapped === 'back' && onBack) {
          onBack();
          return;
        }
        handler(def.mapped);
      };
      const entry: LockedKey = { keycode: def.keycode, callback };
      localLocks.push(entry);
      lockedKeys.push(entry);
      try {
        tizenKeys.registerlockevent(def.keycode, callback);
      } catch {
        // The runtime may reject a key; keep registering the rest.
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const key = KEY_MAP[e.key] || (e.keyCode === 10009 ? 'back' : undefined);
    if (key && key !== 'enter') {
      e.preventDefault();
      if (key === 'back' && onBack) {
        onBack();
      } else {
        handler(key);
      }
    }
  };
  document.addEventListener('keydown', onKeyDown, true);
  // Local grid/custom handlers get first refusal. Their preventDefault marks
  // Enter as consumed; otherwise activate once and suppress the native click.
  const onEnter = (e: KeyboardEvent): void => {
    if ((e.key !== 'Enter' && e.keyCode !== 13) || e.defaultPrevented) return;
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    handler('enter');
  };
  document.addEventListener('keydown', onEnter);

  const releaseLocal = (): void => {
    for (const entry of localLocks) {
      releaseLockedKey(entry);
      const idx = lockedKeys.indexOf(entry);
      if (idx !== -1) lockedKeys.splice(idx, 1);
    }
    localLocks.length = 0;
  };

  return {
    destroy(): void {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keydown', onEnter);
      releaseLocal();
      releaseMediaKeys();
      window.removeEventListener('beforeunload', releaseMediaKeys);
    },
  };
}

export function createFocusManager(container: HTMLElement): {
  focusNext(): void;
  focusPrev(): void;
  focusFirst(): void;
  focusLast(): void;
} {
  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const focusIndexMap = new WeakMap<HTMLElement, number>();

  const getFocusable = (): HTMLElement[] => Array.from(container.querySelectorAll(FOCUSABLE));
  const getIdx = (): number => {
    const tracked = focusIndexMap.get(container);
    if (tracked !== undefined) return tracked;
    const el = container.querySelector(':focus') as HTMLElement | null;
    if (el) return getFocusable().indexOf(el);
    return 0;
  };
  const setIdx = (idx: number) => focusIndexMap.set(container, idx);

  return {
    focusNext(): void {
      const els = getFocusable();
      if (!els.length) return;
      const idx = getIdx();
      setIdx((idx + 1) % els.length);
      els[(idx + 1) % els.length].focus();
    },
    focusPrev(): void {
      const els = getFocusable();
      if (!els.length) return;
      const idx = getIdx();
      setIdx(idx <= 0 ? els.length - 1 : idx - 1);
      els[idx <= 0 ? els.length - 1 : idx - 1].focus();
    },
    focusFirst(): void {
      const els = getFocusable();
      if (els.length) {
        setIdx(0);
        els[0].focus();
      }
    },
    focusLast(): void {
      const els = getFocusable();
      if (els.length) {
        setIdx(els.length - 1);
        els[els.length - 1].focus();
      }
    },
  };
}
