import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startOverhangClock, OVERHANG_CLOCK_TICK_MS } from './OverhangClock';

const format = (now: Date) => `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

describe('overhang clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 12, 5));
    document.body.innerHTML = '<span id="overhang-clock"></span>';
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows the current minute and keeps itself current', () => {
    const el = document.getElementById('overhang-clock') as HTMLElement;
    startOverhangClock({ element: el, format, enabled: true });
    expect(el.textContent).toBe('12:05');
    expect(vi.getTimerCount()).toBe(1);
    vi.setSystemTime(new Date(2026, 10, 9, 12, 6));
    vi.advanceTimersByTime(OVERHANG_CLOCK_TICK_MS);
    expect(el.textContent).toBe('12:06');
  });

  it('draws nothing and schedules nothing while the feature is switched off', () => {
    const el = document.getElementById('overhang-clock') as HTMLElement;
    el.textContent = '12:05';
    startOverhangClock({ element: el, format, enabled: false });
    expect(el.textContent).toBe('');
    // The mandate: disabling a feature stops its work, not just its UI. A clock
    // left polling every 15 s on a TV that is not showing it is the work.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops a clock that was already running when the switch flips off', () => {
    const el = document.getElementById('overhang-clock') as HTMLElement;
    const clock = startOverhangClock({ element: el, format, enabled: true });
    expect(vi.getTimerCount()).toBe(1);
    clock.apply(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(el.textContent).toBe('');
    clock.apply(true);
    expect(vi.getTimerCount()).toBe(1);
    expect(el.textContent).toBe('12:05');
    clock.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('tolerates a shell without a clock element', () => {
    document.body.innerHTML = '';
    const clock = startOverhangClock({ element: null, format, enabled: true });
    expect(vi.getTimerCount()).toBe(1);
    clock.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
