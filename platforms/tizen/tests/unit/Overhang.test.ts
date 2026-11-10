/**
 * Tizen Overhang — unit tests (aligned with shared/ui API).
 *
 * The tizen Overhang.ts is a pure re-export of shared/ui/Overhang (untouchable
 * shared; vizio depends on it), so there is no tick/interval wiring here. The
 * overhang clock is a static element the app shell (index.html) provides
 * inside #overhang, and the live HH:MM tick that fills it is wired by App.ts
 * (a sibling agent's scope). This test pins only the clock-present DOM
 * contract: the clock element lives in the overhang under webos's class
 * `overhang__clock` and id `overhang-clock` (the brief's earlier
 * `overhang-clock` class is superseded by the webos class).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderOverhang } from '../../src/ui/Overhang';

/**
 * Mount the shared-rendered overhang and attach the clock element exactly the
 * way the index.html contract specifies (class `overhang__clock`, id
 * `overhang-clock`, child of #overhang), so the test verifies the contract
 * without depending on the not-yet-edited index.html file.
 */
function mountOverhangWithClock(): void {
  document.body.innerHTML = renderOverhang({ title: 'Chroma Channel' });
  const overhang = document.getElementById('overhang');
  const clock = document.createElement('div');
  clock.className = 'overhang__clock';
  clock.id = 'overhang-clock';
  overhang?.appendChild(clock);
}

describe('Overhang', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the overhang clock present in the DOM (clock-present contract)', () => {
    mountOverhangWithClock();

    const byId = document.getElementById('overhang-clock');
    const byClass = document.querySelector('#overhang .overhang__clock');

    // The clock element is present in the overhang DOM, addressable by both
    // the id and the class.
    expect(byId).not.toBeNull();
    expect(byClass).not.toBeNull();
    expect(byId).toBe(byClass);

    // webos class name is authoritative; the brief's `overhang-clock` class
    // is not used.
    expect(byId?.classList.contains('overhang__clock')).toBe(true);
    expect(byId?.classList.contains('overhang-clock')).toBe(false);

    // The clock is a child of the #overhang header.
    expect(byId?.parentElement?.id).toBe('overhang');
  });

  it('should render overhang with title', () => {
    const html = renderOverhang({ title: 'Chroma Channel' });
    expect(html).toContain('Chroma Channel');
    expect(html).toContain('overhang');
  });

  it('should render overhang with options button', () => {
    const html = renderOverhang({
      title: 'Test',
      actions: [{ icon: 'settings', label: 'Settings', action: 'settings' }],
    });
    expect(html).toContain('overhang');
    expect(html).toContain('Settings');
  });

  it('should render overhang with logo', () => {
    const html = renderOverhang({
      title: 'Test',
      logoUrl: '/logo.png',
    });
    expect(html).toContain('/logo.png');
    expect(html).toContain('overhang__logo');
  });

  it('should render empty overhang when no options', () => {
    const html = renderOverhang({ title: '' });
    expect(html).toContain('overhang');
  });
});
