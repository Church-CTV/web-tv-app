/**
 * Shared overhang clock - the one live HH:MM timer all three platforms draw.
 *
 * It lives here rather than in each App.ts so the operational switch in the
 * delivered profile has one place to act: `enabled: false` clears what is on
 * screen and schedules nothing, so a switched-off feature stops doing work
 * instead of merely hiding its output (CONFIGURATION.md).
 */

/** 15 s: the shortest interval that keeps a minute-resolution clock current. */
export const OVERHANG_CLOCK_TICK_MS = 15_000;

export interface OverhangClockOptions {
  element: HTMLElement | null;
  format: (now: Date) => string;
  enabled: boolean;
  /** Fallback lookup for a shell that mounts its clock after startup. */
  id?: string;
}

export interface OverhangClock {
  /** Re-apply the switch without restarting the app. */
  apply(enabled: boolean): void;
  stop(): void;
  tick(): void;
}

export function startOverhangClock(options: OverhangClockOptions): OverhangClock {
  const id = options.id ?? 'overhang-clock';
  let resolved: HTMLElement | null = options.element;
  let enabled = options.enabled;
  let timer: ReturnType<typeof setInterval> | null = null;

  const resolve = (): HTMLElement | null => {
    resolved = resolved ?? document.getElementById(id);
    return resolved;
  };

  const clearTimer = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const draw = (): void => {
    const el = resolve();
    if (!el) return;
    el.textContent = enabled ? options.format(new Date()) : '';
  };

  const start = (): void => {
    clearTimer();
    if (!enabled) return;
    timer = setInterval(draw, OVERHANG_CLOCK_TICK_MS);
  };

  draw();
  start();

  return {
    apply(next: boolean): void {
      if (next === enabled) return;
      enabled = next;
      draw();
      start();
    },
    stop: clearTimer,
    tick: draw,
  };
}
