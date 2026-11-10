/**
 * PRODUCTION focus-ring gate: the shipped bundle must rasterise the ring.
 *
 * Why this file exists separately from tests/e2e/focus-ring.spec.ts: the root
 * playwright.config.ts drives `vite` on :4301 (isolated webServer + baseURL 4301),
 * so every functional spec under tests/e2e/ — including that one — exercises the
 * DEV server. `vite build` concatenates the shared @imports and the platform
 * stylesheet into one hashed CSS file, and cascade order there is not guaranteed
 * to match dev's runtime-injected order. The defect this repo just fixed is
 * exactly a cascade-order interaction: `shared/styles/components.css` paints a
 * red card ring that the platform rule must outrank, and the ring only became
 * visible once it moved to the poster layer. A production-only ordering
 * regression therefore passes the dev-server suite green, and
 * playwright.production.config.ts only collected bundle-size and perf specs.
 *
 * So this is the painted-ring contract asserted against real `vite preview`
 * bytes on :4173, reusing the same platform-neutral probe as the CTV gates.
 *
 * The second test is a negative control. A probe that always reports "ring
 * present" would prove nothing, so it disables the poster rule with an
 * `!important` override and requires the probe to go blind. That is also the
 * closest automated stand-in for a real LG TV: it cannot feel a remote, but it
 * can prove the assertion is sensitive to the rule that carries the ring.
 */

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  probeFocusedCard,
  expectRingPainted,
  expectNoOverhangClipping,
  ringAlpha,
} from '../ctv/focus-ring.helper';
import { waitForAppReady } from '../ctv/fixtures';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE_FEED = path.join(REPO_ROOT, 'shared', 'test-fixtures', 'mock-feed.json');
const VIEWPORT = { width: 1920, height: 1080 };
// The webOS row scroller whose overflow-x once clipped the scale(1.05) overhang.
const SCROLLER = '#screen-grid .content-grid__row-videos';

async function stubRoutes(page: import('@playwright/test').Page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/vendor/webOSTV.js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    }
    if (/\/feed\/?(?:\?|#|$)/.test(url) || /\/feed\?/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: fs.readFileSync(FIXTURE_FEED, 'utf-8'),
      });
    }
    if (/\/schedule\/?(?:\?|#|$)/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    // Posters come from the live host in the fixture; the card box and its ring
    // do not depend on them, and 404s exercise the poster-fallback layer.
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: '' });
    }
    await route.continue();
  });
}

async function focusFirstCard(page: import('@playwright/test').Page) {
  await page.setViewportSize(VIEWPORT);
  await stubRoutes(page);
  await page.goto('/');
  // The repo's own readiness gate: the grid is up and #screen-loading is gone.
  // The splash layer must be gone too, or it is the topmost element at every
  // ring band and the probe measures the splash instead of the card.
  await waitForAppReady(page);
  await expect(page.locator('#content-grid')).toBeVisible();
  // Element API + ArrowRight, the way the focus manager moves: never the mouse,
  // because :hover masks the defect, and a middle card so no edge sits on the
  // viewport boundary.
  await page.locator('.content-card').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
      )
  );
}

test.describe('production bundle focus ring', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test('the shipped CSS paints the ring on the poster layer at all four edges', async ({
    page,
  }) => {
    await focusFirstCard(page);
    const probe = await probeFocusedCard(page, SCROLLER);
    expectRingPainted(probe, 'webOS production preview');
    expectNoOverhangClipping(probe, 'webOS production preview');
  });

  test('negative control: killing the poster rule makes the probe go blind', async ({ page }) => {
    await focusFirstCard(page);

    // Baseline: the probe sees the ring in the real build.
    expectRingPainted(await probeFocusedCard(page, SCROLLER), 'webOS production baseline');

    // Same DOM, same focus, ring rule overridden the way a lost cascade order or
    // an out-of-order @import would lose it.
    await page.addStyleTag({
      content:
        '.content-card:focus .content-card__poster-img,' +
        ' .content-card:focus-within .content-card__poster-img,' +
        ' .content-card:focus .content-card__poster-fallback,' +
        ' .content-card:focus-within .content-card__poster-fallback {' +
        '   outline: none !important;' +
        ' }',
    });

    const blinded = await probeFocusedCard(page, SCROLLER);
    expect(blinded, 'negative control: focus was lost').not.toBeNull();
    const bare = blinded!.edges.filter((edge) => edge.ring === 'none');
    expect(
      bare.length,
      `negative control: the probe still reports a ring with the poster rule disabled (${blinded!.edges
        .map((e) => `${e.name}=${e.ring}`)
        .join(', ')}) — it is not sensitive to the rule that carries the ring`
    ).toBe(4);
  });

  test('negative control: a transparent ring fails the gate, not just a missing one', async ({
    page,
  }) => {
    // Width and style survive an `outline-color: transparent`; hit-testing does too.
    // Without an alpha check that ring would pass every gate in the repo while
    // painting nothing a viewer can see.
    await focusFirstCard(page);
    await page.addStyleTag({
      content:
        '.content-card:focus .content-card__poster-img,' +
        ' .content-card:focus-within .content-card__poster-img,' +
        ' .content-card:focus .content-card__poster-fallback,' +
        ' .content-card:focus-within .content-card__poster-fallback {' +
        '   outline-color: transparent !important;' +
        ' }',
    });
    const washed = await probeFocusedCard(page, SCROLLER);
    expect(washed, 'negative control: focus was lost').not.toBeNull();
    expect(
      washed!.edges.every((edge) => ringAlpha(edge.ring) < 0.5),
      `negative control: the alpha check did not trip on a transparent ring (${washed!.edges
        .map((e) => `${e.name}=${e.ring}`)
        .join(', ')})`
    ).toBe(true);
    expect(
      washed!.edges.filter((edge) => edge.ring !== 'none').length,
      'negative control: the transparent ring should still register as a ring, so this is the ' +
        'case the alpha check exists to catch'
    ).toBe(4);
  });
});
