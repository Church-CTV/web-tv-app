/**
 * GridNav — spatial D-pad routing unit tests (K2a).
 *
 * Covers the shared routing logic used by BOTH input paths:
 *  - the DOM keydown handlers (browser / E2E), and
 *  - the App-level webOSTV.js keysListener callbacks (real TV) via routeDpadKey.
 *
 * DOM is built manually (no component imports) so the tests are hermetic and
 * directly verify the routing rules:
 *  - right: next card, wraps to first in row
 *  - left: bridges to the vertically nearest left-nav item
 *  - down: same column (clamped) in next row; contained on last row
 *  - up: same column (clamped) in previous row; contained on first row
 *  - nav right: bridges to the vertically nearest grid card
 *  - nav up/down: contained at edges
 *  - fallback: global up/down cycler when grid/nav not on screen
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { routeDpadKey, focusNavItemNearest, focusCardNearest } from '../../src/ui/GridNav';

/** Build the home screen DOM shape used by the app. */
function buildHome(): {
  grid: HTMLElement;
  nav: HTMLElement;
  cards: HTMLElement[];
  navItems: HTMLElement[];
} {
  const grid = document.createElement('div');
  grid.className = 'content-grid';

  const row = (cards: HTMLElement[]) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'content-grid__row';
    const videos = document.createElement('div');
    videos.className = 'content-grid__row-videos';
    cards.forEach((c) => videos.appendChild(c));
    rowEl.appendChild(videos);
    return rowEl;
  };

  const mkCard = (id: string) => {
    const c = document.createElement('div');
    c.className = 'content-card';
    c.setAttribute('data-video-id', id);
    c.setAttribute('tabindex', '0');
    return c;
  };

  const row1Cards = [mkCard('a'), mkCard('b'), mkCard('c')];
  const row2Cards = [mkCard('d'), mkCard('e')];
  grid.appendChild(row(row1Cards));
  grid.appendChild(row(row2Cards));

  const leftNavContainer = document.createElement('div');
  leftNavContainer.id = 'left-nav';
  const nav = document.createElement('nav');
  nav.className = 'left-nav';
  const navItems = ['Home', 'Search', 'Schedule'].map((label) => {
    const b = document.createElement('button');
    b.className = 'left-nav__item';
    b.setAttribute('aria-label', label);
    b.textContent = label;
    nav.appendChild(b);
    return b;
  });
  leftNavContainer.appendChild(nav);

  // Wrap grid and nav in the screen-grid container with screen-active class
  // to match the real app DOM structure (K2b).
  const screenGrid = document.createElement('div');
  screenGrid.id = 'screen-grid';
  screenGrid.className = 'screen screen-active';
  screenGrid.appendChild(leftNavContainer);
  screenGrid.appendChild(grid);

  document.body.appendChild(screenGrid);

  return {
    grid,
    nav,
    cards: [...row1Cards, ...row2Cards],
    navItems,
  };
}

function rectStub(el: HTMLElement, top: number, height: number): void {
  el.getBoundingClientRect = () =>
    ({
      top,
      height,
      left: 0,
      width: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('routeDpadKey (TV remote path, K2a)', () => {
  let ctx: ReturnType<typeof buildHome>;

  beforeEach(() => {
    document.body.innerHTML = '';
    (HTMLElement.prototype as never as { scrollIntoView: unknown }).scrollIntoView = () => {};
    ctx = buildHome();
  });

  afterEach(() => {
    document.getElementById('screen-grid')?.remove();
  });

  it('preserves vertical position while moving along a rendered shared row', () => {
    ctx.grid
      .querySelectorAll('.content-grid__row-videos')
      .forEach((el) => (el.className = 'content-category__row'));
    const scroll = vi.fn();
    ctx.cards[1].scrollIntoView = scroll;
    ctx.cards[0].focus();
    expect(routeDpadKey('right')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[1]);
    expect(scroll).toHaveBeenCalledWith({
      behavior: 'smooth',
      inline: 'nearest',
      block: 'nearest',
    });
  });

  it('routes Left from any shared-row card to Home rail', () => {
    ctx.nav.className = 'left-nav-inner';
    ctx.grid
      .querySelectorAll('.content-grid__row-videos')
      .forEach((el) => (el.className = 'content-category__row'));
    ctx.cards[1].focus();
    expect(routeDpadKey('left')).toBe(true);
    expect(document.activeElement).toBe(ctx.navItems[0]);
  });

  it('moves focus right to the next card in the row', () => {
    ctx.cards[0].focus();
    expect(routeDpadKey('right')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[1]);
  });

  it('wraps right from the last card to the first card of the row', () => {
    ctx.cards[2].focus();
    expect(routeDpadKey('right')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[0]);
  });

  it('moves focus down to the same column in the next row', () => {
    // col 1: card b (index 1) → card e (index 4)
    ctx.cards[1].focus();
    expect(routeDpadKey('down')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[4]);
  });

  it('clamps down when the next row has fewer cards', () => {
    // col 2: card c (index 2) → row2 has only 2 cards → clamp to index 4
    ctx.cards[2].focus();
    expect(routeDpadKey('down')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[4]);
  });

  it('contains down focus on the last row', () => {
    ctx.cards[3].focus();
    expect(routeDpadKey('down')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[3]);
  });

  it('moves focus up to the same column in the previous row', () => {
    // col 1: card e (index 4) → card b (index 1)
    ctx.cards[4].focus();
    expect(routeDpadKey('up')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[1]);
  });

  it('contains up focus on the first row', () => {
    ctx.cards[0].focus();
    expect(routeDpadKey('up')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[0]);
  });

  it('moves focus left to the nav entry item (Roku: current-page rail entry)', () => {
    // Roku parity: left from a grid card lands on the nav rail entry
    // (Home = the current page's rail item), NOT the geometrically
    // nearest rail icon. Vertical proximity routing caused search/settings
    // jumps from mid-list rows.
    rectStub(ctx.cards[1], 250, 100);
    rectStub(ctx.navItems[0], 50, 100);
    rectStub(ctx.navItems[1], 250, 100);
    rectStub(ctx.navItems[2], 450, 100);

    ctx.cards[1].focus();
    expect(routeDpadKey('left')).toBe(true);
    expect(document.activeElement).toBe(ctx.navItems[0]);
  });

  it('absorbs left when no nav exists (containment, no dead end)', () => {
    ctx.nav.remove();
    ctx.cards[0].focus();
    expect(routeDpadKey('left')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[0]);
  });

  it('moves right from the nav to the nearest grid card (vertical proximity)', () => {
    rectStub(ctx.navItems[2], 500, 100); // y=550
    rectStub(ctx.cards[0], 50, 100); // y=100
    rectStub(ctx.cards[4], 500, 100); // y=550
    ctx.navItems[2].focus();
    expect(routeDpadKey('right')).toBe(true);
    expect(document.activeElement).toBe(ctx.cards[4]);
  });

  it('contains nav up on the first item', () => {
    ctx.navItems[0].focus();
    expect(routeDpadKey('up')).toBe(true);
    expect(document.activeElement).toBe(ctx.navItems[0]);
  });

  it('contains nav down on the last item', () => {
    ctx.navItems[2].focus();
    expect(routeDpadKey('down')).toBe(true);
    expect(document.activeElement).toBe(ctx.navItems[2]);
  });

  it('moves down within the nav between items', () => {
    ctx.navItems[0].focus();
    expect(routeDpadKey('down')).toBe(true);
    expect(document.activeElement).toBe(ctx.navItems[1]);
  });

  it('absorbs left when on the nav (containment)', () => {
    ctx.navItems[0].focus();
    expect(routeDpadKey('left')).toBe(true);
    expect(document.activeElement).toBe(ctx.navItems[0]);
  });

  it('ignores keys when focus is outside grid and nav zones', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(routeDpadKey('right')).toBe(false);
    expect(routeDpadKey('down')).toBe(false);
    btn.remove();
  });

  it('falls back to the global cycler when the grid screen is not active', () => {
    // Deactivate the grid screen so routeDpadKey falls back to the cycler.
    const screenGrid = document.getElementById('screen-grid');
    screenGrid?.classList.remove('screen-active');

    const next = vi.fn();
    const prev = vi.fn();
    const unrelated = document.createElement('button');
    document.body.appendChild(unrelated);
    unrelated.focus();

    expect(routeDpadKey('down', next, prev)).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).not.toHaveBeenCalled();

    expect(routeDpadKey('up', next, prev)).toBe(true);
    expect(prev).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    unrelated.remove();
  });
});

describe('focusNavItemNearest / focusCardNearest (K2a helpers)', () => {
  let ctx: ReturnType<typeof buildHome>;

  beforeEach(() => {
    document.body.innerHTML = '';
    ctx = buildHome();
  });

  afterEach(() => {
    document.getElementById('screen-grid')?.remove();
  });

  it('picks the vertically nearest nav item', () => {
    rectStub(ctx.cards[0], 0, 100); // y=50
    rectStub(ctx.navItems[0], 0, 100); // y=50
    rectStub(ctx.navItems[1], 250, 100); // y=300
    rectStub(ctx.navItems[2], 450, 100); // y=500
    focusNavItemNearest(ctx.nav, ctx.cards[0]);
    expect(document.activeElement).toBe(ctx.navItems[0]);
  });

  it('picks the vertically nearest grid card', () => {
    rectStub(ctx.navItems[2], 500, 100); // y=550
    rectStub(ctx.cards[0], 0, 100); // y=50
    rectStub(ctx.cards[4], 500, 100); // y=550
    focusCardNearest(ctx.grid, ctx.navItems[2]);
    expect(document.activeElement).toBe(ctx.cards[4]);
  });
});

import { bestSpatialPick, isInRange, type Rect } from '../../src/ui/SpatialFocus';
import { spatialNavActiveScreen } from '../../src/ui/GridNav';

const R = (left: number, top: number, w: number, h: number): Rect => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
  width: w,
  height: h,
});

describe('SpatialFocus (pure geometry, K3a)', () => {
  // A 3x2 keyboard grid:
  //   a(0,0)  b(100,0)  c(200,0)
  //   d(0,100) e(100,100) f(200,100)
  const a = R(0, 0, 50, 40);
  const b = R(100, 0, 50, 40);
  const c = R(200, 0, 50, 40);
  const d = R(0, 100, 50, 40);
  const e = R(100, 100, 50, 40);
  const f = R(200, 100, 50, 40);
  const grid: Record<string, Rect> = { a, b, c, d, e, f };

  it('down moves to the directly-below key (column alignment wins)', () => {
    const pick = bestSpatialPick(
      a,
      'down',
      (['b', 'c', 'd', 'e', 'f'] as const).map((k) => ({ rect: grid[k] }))
    );
    expect(pick?.rect).toBe(d); // directly below a
  });

  it('down prefers the aligned column over a nearer diagonal', () => {
    // From b, down should go to e (same column), not d or f.
    const pick = bestSpatialPick(
      b,
      'down',
      (['a', 'c', 'd', 'e', 'f'] as const).map((k) => ({ rect: grid[k] }))
    );
    expect(pick?.rect).toBe(e);
  });

  it('right moves to the next key in the row', () => {
    const pick = bestSpatialPick(
      a,
      'right',
      (['b', 'c', 'd', 'e', 'f'] as const).map((k) => ({ rect: grid[k] }))
    );
    expect(pick?.rect).toBe(b);
  });

  it('up on the top row is contained (returns null)', () => {
    const pick = bestSpatialPick(
      a,
      'up',
      (['b', 'c', 'd', 'e', 'f'] as const).map((k) => ({ rect: grid[k] }))
    );
    expect(pick).toBeNull();
  });

  it('left on the left column is contained (returns null)', () => {
    const pick = bestSpatialPick(
      a,
      'left',
      (['b', 'c', 'd', 'e', 'f'] as const).map((k) => ({ rect: grid[k] }))
    );
    expect(pick).toBeNull();
  });

  it('isInRange accepts a directly-below key and rejects a same-row key', () => {
    expect(isInRange(a, d, 'down')).toBe(true); // d is directly below a
    expect(isInRange(a, b, 'down')).toBe(false); // b is in the same row
    expect(isInRange(a, d, 'up')).toBe(false); // d is below, not above
  });

  it('bestSpatialPick ignores off-direction candidates entirely', () => {
    // From a, "up" should be contained even though same-row keys exist.
    const pick = bestSpatialPick(
      a,
      'up',
      (['b', 'c', 'd', 'e', 'f'] as const).map((k) => ({ rect: grid[k] }))
    );
    expect(pick).toBeNull();
  });
});

describe('spatialNavActiveScreen (DOM routing, K3a)', () => {
  function buildSearchScreen() {
    document.body.innerHTML = '';
    const screen = document.createElement('div');
    screen.id = 'screen-search';
    screen.className = 'screen screen-active';
    const input = document.createElement('input');
    input.className = 'search-screen__input';
    input.tabIndex = 0;
    // OSK: row1 = q,w  row2 = a,s  (small 2-column grid)
    const keys: HTMLElement[] = [];
    const keyGeo: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [0, 100],
      [100, 100],
    ];
    keyGeo.forEach(([x, y], i) => {
      const k = document.createElement('button');
      k.className = 'osk-key';
      k.dataset.key = 'qwaz'[i];
      k.tabIndex = 0;
      screen.appendChild(k);
      keys.push(k);
    });
    screen.appendChild(input);
    document.body.appendChild(screen);

    // Persistent left nav (sibling of the screen, like the real app).
    const navWrap = document.createElement('div');
    navWrap.id = 'left-nav';
    const nav = document.createElement('nav');
    nav.className = 'left-nav';
    const navItems: HTMLElement[] = [];
    ['home', 'search', 'settings'].forEach((label) => {
      const b = document.createElement('button');
      b.className = 'left-nav__item';
      b.setAttribute('aria-label', label);
      b.tabIndex = 0;
      nav.appendChild(b);
      navItems.push(b);
    });
    navWrap.appendChild(nav);
    document.body.appendChild(navWrap);
    return { screen, input, keys, navItems };
  }

  // Stub a real, non-zero rect + visible offsetParent so spatial picking works
  // in jsdom (which reports zero rects and null offsetParent by default).
  function setGeo(el: HTMLElement, left: number, top: number, w: number, h: number): void {
    el.getBoundingClientRect = () =>
      ({
        top,
        left,
        right: left + w,
        bottom: top + h,
        width: w,
        height: h,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(el, 'offsetParent', { get: () => document.body, configurable: true });
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves down from a key to the key directly below it', () => {
    const { input, keys } = buildSearchScreen();
    // input at y=0 (full width); keys q(0,50) w(100,50) a(0,150) s(100,150)
    setGeo(input, 0, 0, 300, 40);
    setGeo(keys[0], 0, 50, 50, 40);
    setGeo(keys[1], 100, 50, 50, 40);
    setGeo(keys[2], 0, 150, 50, 40);
    setGeo(keys[3], 100, 150, 50, 40);
    keys[1].focus(); // focus 'w'
    expect(spatialNavActiveScreen('down').handled).toBe(true);
    expect(document.activeElement).toBe(keys[3]); // 's' below 'w'
  });

  it('bridges left from the content to the persistent nav', () => {
    buildSearchScreen();
    const keys = Array.from(document.querySelectorAll<HTMLElement>('.osk-key'));
    const navItems = Array.from(document.querySelectorAll<HTMLElement>('.left-nav__item'));
    const input = document.querySelector<HTMLElement>('.search-screen__input');
    setGeo(input!, 300, 0, 300, 40);
    setGeo(keys[0], 300, 50, 50, 40);
    setGeo(keys[1], 400, 50, 50, 40);
    // Nav items sit in the left column at x=0
    navItems.forEach((n, i) => setGeo(n, 0, 40 + i * 60, 40, 40));
    keys[0].focus(); // focus the leftmost key at x=300
    expect(spatialNavActiveScreen('left').handled).toBe(true);
    // Should land on the nav item vertically nearest the key (y=70 center).
    // Nav centers: 60,120,180 -> nearest to 70 is index 0.
    expect(document.activeElement).toBe(navItems[0]);
  });

  it('falls back (handled:false) in a zero-rect environment like jsdom', () => {
    const { input } = buildSearchScreen();
    // No setGeo calls: jsdom reports zero rects -> spatial must decline so the
    // legacy cycler (or nothing) takes over, never a broken move.
    input.focus();
    expect(spatialNavActiveScreen('down').handled).toBe(false);
  });
});
