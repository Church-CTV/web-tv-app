/**
 * E2E Test: the home-grid focus ring must be PAINTED, not merely declared.
 *
 * Defect F100 (user-reported 2026-10-26): with D-pad/programmatic focus on a
 * content card the computed style was correct (`outline: 3px solid #fff`,
 * `outline-offset: -3px`) yet no ring reached the screen, because
 *
 *   1. the ring was drawn as an `outline` on `.content-card`, and an element's
 *      outline paints BELOW its positioned descendants — the shared card
 *      renderer nests `<img class="content-card__poster-img">` at
 *      `position: absolute; z-index: 1` (shared/ui/ContentCard.ts), which
 *      covered the left and right sides; and
 *   2. `.content-grid__row-videos { overflow-x: auto }` forces `overflow-y` to
 *      clip, so the `scale(1.05)` overhang of the focused card was cropped at
 *      top and bottom.
 *
 * Everything else in the suite checks focus POSITION (grid-parity.spec.ts even
 * compensates for the scale) or ARIA/contrast (axe-core, check-contrast), so a
 * ring that never rasterises passed every gate. This spec closes that gap by
 * asserting the ring layer is the TOPMOST paint at each card edge
 * (document.elementFromPoint) and that the topmost element actually carries a
 * solid ring of non-zero width.
 *
 * Mouse hovering is deliberately avoided: `:hover` would mask the defect.
 *
 * The two tests guard independent halves of the defect. Test 1 (ring painted)
 * fails at every viewport size. Test 2 (scroller clipping) is resolution
 * dependent: the clip reproduces on the 1920x1080 production build, where
 * `document.elementFromPoint` on the focused card returned `DIV.content-grid__row`
 * at the top edge and `DIV.content-grid` at the bottom, and it passes at the
 * 1280x720 E2E viewport where the smaller cards do not overhang the scroller.
 * Both must hold, so a fix that only moves the ring layer still has to stop the
 * row scroller from cropping the zoom.
 */

import { test, expect, waitForAppReady } from './fixtures';

const RING_BAND_INSET = 2; // px inside the card edge where a >=2px ring must live
const MIN_RING_WIDTH_PX = 2;

type EdgeProbe = { name: string; x: number; y: number };

interface ProbeResult {
  focusedIsCard: boolean;
  cardRect: { top: number; bottom: number; left: number; right: number };
  edges: Array<EdgeProbe & { hitTag: string; hitClass: string; inCard: boolean; ring: string }>;
  clip: { topOverhang: number; bottomOverhang: number };
}

/**
 * Probe the focused card from inside the page: which element is topmost at each
 * edge mid-point, does that element belong to the focused card, and does it
 * carry a visible solid ring.
 */
const probeFocusedCard = (page: import('@playwright/test').Page): Promise<ProbeResult | null> =>
  page.evaluate((inset: number) => {
    const card = document.activeElement as HTMLElement | null;
    if (!card || !card.classList.contains('content-card')) {
      return null;
    }
    const r = card.getBoundingClientRect();
    const probes: EdgeProbe[] = [
      { name: 'top', x: r.left + r.width / 2, y: r.top + inset },
      { name: 'bottom', x: r.left + r.width / 2, y: r.bottom - inset },
      { name: 'left', x: r.left + inset, y: r.top + r.height / 2 },
      { name: 'right', x: r.right - inset, y: r.top + r.height / 2 },
    ];

    const edges = probes.map((p) => {
      const hit = document.elementFromPoint(p.x, p.y);
      let ring = 'none';
      if (hit) {
        const s = getComputedStyle(hit);
        const outlinePx = parseFloat(s.outlineWidth) || 0;
        const borderPx = parseFloat(s.borderTopWidth) || 0;
        const outlineRing = outlinePx >= 2 && s.outlineStyle !== 'none';
        const borderRing = borderPx >= 2 && s.borderTopStyle !== 'none';
        const shadowRing = s.boxShadow !== 'none' && s.boxShadow.includes('inset');
        if (outlineRing) {
          ring = `outline ${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
        } else if (borderRing) {
          ring = `border ${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`;
        } else if (shadowRing) {
          ring = `inset-shadow ${s.boxShadow.slice(0, 60)}`;
        }
      }
      return {
        ...p,
        hitTag: hit ? hit.tagName : 'null',
        hitClass: hit ? String(hit.className || hit.id || '') : '',
        // The ring band must belong to the focused card's own subtree. A hit
        // OUTSIDE it (the row or grid container) means the band was clipped
        // away; a hit inside it that carries no ring means the ring is painted
        // underneath that layer and never rasterises.
        inCard: !!hit && (hit === card || card.contains(hit)),
        ring,
      };
    });

    // The focused card is zoomed with scale(1.05). A row scroller that clips
    // overflow crops that overhang, so the top/bottom ring band never paints.
    const scroller = card.closest('.content-grid__row-videos');
    const sr = scroller ? scroller.getBoundingClientRect() : r;
    return {
      focusedIsCard: true,
      cardRect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      edges,
      clip: { topOverhang: sr.top - r.top, bottomOverhang: r.bottom - sr.bottom },
    };
  }, RING_BAND_INSET);

test('home grid: focused card paints a ring that is topmost at all four edges', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppReady(page);
  await expect(page.locator('#content-grid')).toBeVisible();

  // Focus the first card the way the remote focus manager does it: give the
  // element focus, never the mouse. Then move right so the focused card is a
  // middle card, whose edges are not adjacent to the viewport edge.
  await page.locator('.content-card').first().focus();
  await page.keyboard.press('ArrowRight');

  const result = await probeFocusedCard(page);
  expect(result, 'ArrowRight must leave focus on a content card').not.toBeNull();
  expect(result!.focusedIsCard).toBe(true);

  for (const edge of result!.edges) {
    const where = `${edge.name} edge (${Math.round(edge.x)},${Math.round(edge.y)})`;
    // 1. Nothing may paint over the ring band: the topmost element at the ring
    //    band must belong to the focused card, not the poster <img> and not a
    //    grid container (a container means the band was clipped away).
    expect(
      edge.inCard,
      `${where}: topmost element is ${edge.hitTag}.${edge.hitClass}, so something paints over the focus ring`
    ).toBe(true);
    // 2. A real ring must exist on that topmost element.
    expect(
      edge.ring,
      `${where}: topmost element carries no visible ring (got ${edge.ring})`
    ).not.toBe('none');
  }
});

test('home grid: the row scroller must not clip the focused card', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await expect(page.locator('#content-grid')).toBeVisible();

  await page.locator('.content-card').first().focus();
  await page.keyboard.press('ArrowRight');

  const result = await probeFocusedCard(page);
  expect(result, 'ArrowRight must leave focus on a content card').not.toBeNull();

  // scale(1.05) grows the card about its centre. Whatever the ring layer is,
  // the row scroller must leave that overhang visible instead of clipping it.
  expect(
    result!.clip.topOverhang,
    `focused card overhangs the row scroller by ${result!.clip.topOverhang.toFixed(1)}px at the top`
  ).toBeLessThanOrEqual(MIN_RING_WIDTH_PX);
  expect(
    result!.clip.bottomOverhang,
    `focused card overhangs the row scroller by ${result!.clip.bottomOverhang.toFixed(1)}px at the bottom`
  ).toBeLessThanOrEqual(MIN_RING_WIDTH_PX);
});
