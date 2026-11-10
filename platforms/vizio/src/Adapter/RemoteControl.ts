/**
 * Vizio RemoteControl Adapter — key event listeners for remote control.
 * Vizio uses web-key events.
 */

export type VizioKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'enter'
  | 'return'
  | 'back'
  | 'volume_up'
  | 'volume_down'
  | 'menu'
  | 'guide'
  | 'info'
  | 'exit'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue';

/**
 * Create a remote control adapter for Vizio SmartCast.
 */
export function createRemoteControl(
  handler: (key: VizioKey) => void,
  onBack?: () => void
): { destroy(): void } {
  const KEY_MAP: Record<string, VizioKey> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'enter',
    Return: 'return',
    Escape: 'back',
    Digit1: 'red',
    Digit2: 'green',
    Digit3: 'yellow',
    Digit4: 'blue',
  };

  const listener = (e: KeyboardEvent) => {
    const key = KEY_MAP[e.key] || (e.keyCode === 13 ? 'enter' : undefined);
    if (!key || e.defaultPrevented) return;
    if (key === 'enter' && e.repeat) {
      e.preventDefault();
      return;
    }
    if (key === 'back' || key === 'return') {
      e.preventDefault();
      if (onBack) onBack();
      else handler(key);
      return;
    }
    if (
      key === 'enter' &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement)
    )
      e.preventDefault();
    handler(key);
  };
  document.addEventListener('keydown', listener);
  return {
    destroy(): void {
      document.removeEventListener('keydown', listener);
    },
  };
}

/**
 * Create a focus manager for D-pad navigation.
 */
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
