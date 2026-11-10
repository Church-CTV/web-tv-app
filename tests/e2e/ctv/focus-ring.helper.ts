/**
 * Shared focus-ring probe for the CTV production-preview projects.
 *
 * Why this exists: the suite already proves where focus LANDS (grid-parity,
 * screen-transition) and that colors pass axe/threshold checks, but nothing
 * proved that the focus ring RASTERISES. On webOS the ring computed as
 * `outline: 3px solid #fff` on `.content-card` while painting nothing, because
 * the shared card renderer nests `<img class="content-card__poster-img">` at
 * `position:absolute` over the card's own outline, and the row scroller's
 * `overflow-x:auto` clipped the `scale(1.05)` overhang (defect F100).
 *
 * Tizen and Vizio render the identical card DOM (platforms/<p>/src/ui/ContentCard.ts
 * re-exports @ctv/shared/ui/ContentCard), so they inherit both halves of that
 * defect and need the same acceptance gate. This helper is the probe used by
 * `tizen-focus-ring.spec.ts` and `vizio-focus-ring.spec.ts`; it is not a spec,
 * so no project testMatch collects it.
 *
 * Contract, deliberately platform-neutral:
 *   - the topmost element at each ring band must belong to the focused card, and
 *   - it must be the poster layer (`.content-card__poster*`), because that is the
 *     only layer that paints above the card box, and
 *   - it must carry a solid ring of at least 2px, and
 *   - that ring must be opaque enough to see: an alpha of at least 0.5.
 * Opacity is asserted here because a transparent ring still hit-tests, still
 * reports a computed `outline: 3px solid`, and would pass every other gate in the
 * repo - the same computed-is-not-painted class as the original defect, one layer
 * deeper. The hue's contrast against each surface is gated by
 * `scripts/check-contrast.mjs`, which is a static token check and cannot see alpha.
 */

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const RING_BAND_INSET = 2; // px inside the card edge where a >=2px ring must live
const MIN_RING_WIDTH_PX = 2;
const MIN_RING_ALPHA = 0.5;

/**
 * Alpha of the colour the probe captured.
 *
 * The gate this feeds rejects a see-through ring, so the parser has to read whatever
 * the webview actually serialises, not only what Chrome reports. Chrome normalises a
 * computed colour to `rgb()`/`rgba()`, but CSS Color 4 lets a conforming engine return
 * `rgb(255 255 255 / 40%)`, `color(srgb 1 1 1 / 0.4)`, `oklch(0.9 0.1 50 / 0.2)` or
 * `hwb(0 0% 100% / 0.3)`, and a Tizen or Vizio webview is under no obligation to
 * collapse those into the legacy form. The previous version read only `rgb()`/`rgba()`
 * and treated a non-numeric fourth value as opaque, so every one of those came back as
 * alpha 1 and a half-transparent ring passed the gate.
 *
 * Anything the parser cannot resolve returns 0 (fail closed): an unrecognised
 * serialisation must stop the gate with a message, not certify a ring it never read.
 * A named colour is opaque by definition; `transparent` and `currentColor` are not
 * resolvable here, so they report 0 too.
 */
export function ringAlpha(ring: string): number {
  const parts = ring.match(/^(?:outline|border)\s+\S+\s+\S+\s+(.+)$/);
  const color = (parts ? parts[1] : ring).trim();
  if (!color) return 0;
  if (color === 'transparent' || color.toLowerCase() === 'currentcolor') return 0;

  // `#rgba` / `#rrggbbaa`: the alpha nibble(s) are the last digits of the literal.
  const hex = color.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 6) return 1;
    if (digits.length === 4) return parseInt(digits[3].repeat(2), 16) / 255;
    if (digits.length === 8) return parseInt(digits.slice(6, 8), 16) / 255;
    return 0;
  }

  const fn = color.match(/^([a-zA-Z-]+)\(([^()]*)\)$/);
  if (!fn) {
    // A bare identifier (`white`, `aliceblue`) is a named colour: opaque.
    return /^[a-zA-Z-]+$/.test(color) ? 1 : 0;
  }

  const name = fn[1].toLowerCase();
  const inner = fn[2].trim();

  // `color-mix` needs both components and a percentage to yield an alpha, and its
  // components can themselves be functions. None of that is modelled here, and a mix
  // against `transparent` is the common authoring shape for a softened ring, so the
  // only honest answer is 0: fail the gate rather than certify an opacity never read.
  if (name === 'color-mix') return 0;

  const alphaOf = (token: string | undefined): number | null => {
    if (token === undefined) return null;
    const raw = token.trim();
    const isPercent = raw.endsWith('%');
    const value = Number(isPercent ? raw.slice(0, -1) : raw);
    if (!Number.isFinite(value)) return null;
    const alpha = isPercent ? value / 100 : value;
    return Math.min(1, Math.max(0, alpha));
  };

  // Modern syntax puts the alpha after a slash in every colour function.
  const slash = inner.split('/');
  if (slash.length >= 2) return alphaOf(slash[slash.length - 1]) ?? 0;

  // Legacy comma syntax, and the space-separated form of the functions whose grammar
  // allows a trailing alpha without a slash (`rgb(0 0 0 .5)`, `color(srgb 1 1 1 .4)`).
  // `oklch(0.9 0.1 50)` ends in a bare number too - the hue - which is why this
  // trailing-number reading is limited to the functions that define it.
  const comma = inner.split(',').map((arg) => arg.trim());
  if (comma.length >= 4 && /^(rgb|rgba|hsl|hsla)$/.test(name)) return alphaOf(comma[3]) ?? 0;
  if (comma.length === 1 && /^(rgb|rgba|hsl|hsla|color)$/.test(name)) {
    // The space grammar carries alpha only as a FOURTH token (`rgb(0 0 0 .5)`). With
    // three tokens the last one is a channel, and channels like `0`, `0%` or `50%` are
    // not alphas - reading one made opaque black and saturated HSL rings report a
    // fraction, so the gate failed a ring that is fully painted.
    const tokens = inner.split(/\s+/);
    if (tokens.length < 4) return 1;
    return alphaOf(tokens[tokens.length - 1]) ?? 1;
  }
  return 1;
}

interface EdgeHit {
  name: string;
  x: number;
  y: number;
  hitTag: string;
  hitClass: string;
  inCard: boolean;
  onPoster: boolean;
  ring: string;
}

export interface RingProbe {
  cardRect: { top: number; bottom: number; left: number; right: number };
  edges: EdgeHit[];
  clip: { topOverhang: number; bottomOverhang: number; scrollerFound: boolean };
}

/**
 * Focus a card with the element API only (never the mouse: `:hover` masks the
 * defect), then report what actually paints at each edge mid-point.
 *
 * @param scrollerSelector row scroller to measure the scale(1.05) overhang
 *   against. A platform without a row scroller reports `scrollerFound: false`
 *   and zero overhang, so the clip assertion stays honest rather than passing
 *   by accident.
 */
export async function probeFocusedCard(
  page: Page,
  scrollerSelector: string
): Promise<RingProbe | null> {
  return page.evaluate(
    ({ inset, scroller }: { inset: number; scroller: string }) => {
      const card = document.activeElement as HTMLElement | null;
      if (!card || !card.classList.contains('content-card')) {
        return null;
      }
      const r = card.getBoundingClientRect();
      const points = [
        { name: 'top', x: r.left + r.width / 2, y: r.top + inset },
        { name: 'bottom', x: r.left + r.width / 2, y: r.bottom - inset },
        { name: 'left', x: r.left + inset, y: r.top + r.height / 2 },
        { name: 'right', x: r.right - inset, y: r.top + r.height / 2 },
      ];

      const edges = points.map((p) => {
        const hit = document.elementFromPoint(p.x, p.y);
        let ring = 'none';
        if (hit) {
          const s = getComputedStyle(hit);
          const outlinePx = parseFloat(s.outlineWidth) || 0;
          const borderPx = parseFloat(s.borderTopWidth) || 0;
          if (outlinePx >= 2 && s.outlineStyle !== 'none') {
            ring = `outline ${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
          } else if (borderPx >= 2 && s.borderTopStyle !== 'none') {
            ring = `border ${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`;
          }
        }
        const cls = hit ? String(hit.className || hit.id || '') : '';
        return {
          ...p,
          hitTag: hit ? hit.tagName : 'null',
          hitClass: cls,
          inCard: !!hit && (hit === card || card.contains(hit)),
          onPoster: cls.includes('content-card__poster'),
          ring,
        };
      });

      const el = document.querySelector(scroller);
      const sr = el ? el.getBoundingClientRect() : r;
      return {
        cardRect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
        edges,
        clip: {
          topOverhang: sr.top - r.top,
          bottomOverhang: r.bottom - sr.bottom,
          scrollerFound: !!el,
        },
      };
    },
    { inset: RING_BAND_INSET, scroller: scrollerSelector }
  );
}

/** Assert the four edge bands show a real ring on the poster layer. */
export function expectRingPainted(result: RingProbe | null, where: string): void {
  expect(result, `${where}: focus did not land on a content card`).not.toBeNull();
  for (const edge of result!.edges) {
    const at = `${where}: ${edge.name} edge (${Math.round(edge.x)},${Math.round(edge.y)})`;
    expect(
      edge.inCard,
      `${at}: topmost element is ${edge.hitTag}.${edge.hitClass}, so something paints over the focus ring`
    ).toBe(true);
    expect(
      edge.onPoster,
      `${at}: ring band must be carried by the poster layer, got ${edge.hitTag}.${edge.hitClass}`
    ).toBe(true);
    expect(edge.ring, `${at}: topmost element carries no visible ring (got ${edge.ring})`).not.toBe(
      'none'
    );
    // A transparent outline still hit-tests and still reports a computed
    // `outline: 3px solid`, so width and style alone cannot certify a visible ring.
    const alpha = ringAlpha(edge.ring);
    expect(
      alpha,
      `${at}: ring is ${edge.ring} - alpha ${alpha.toFixed(
        2
      )} is below ${MIN_RING_ALPHA}, so the ring is painted but not visible`
    ).toBeGreaterThanOrEqual(MIN_RING_ALPHA);
  }
}

/** Assert the row scroller leaves the focused card's scale(1.05) overhang visible. */
export function expectNoOverhangClipping(result: RingProbe | null, where: string): void {
  expect(result, `${where}: focus did not land on a content card`).not.toBeNull();
  if (!result!.clip.scrollerFound) {
    // No row scroller on this platform, so there is nothing to clip. Recorded
    // rather than asserted so a future scroller cannot hide a regression here.
    return;
  }
  for (const side of ['top', 'bottom'] as const) {
    const over = side === 'top' ? result!.clip.topOverhang : result!.clip.bottomOverhang;
    expect(
      over,
      `${where}: focused card overhangs its row scroller by ${over.toFixed(1)}px at the ${side}`
    ).toBeLessThanOrEqual(MIN_RING_WIDTH_PX);
  }
}
