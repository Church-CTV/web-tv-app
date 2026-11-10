/**
 * E2E: the Tizen home grid must PAINT a focus ring (project `tizen`, :4181).
 *
 * Tizen's card rule drew the ring on `.content-card` while the shared poster
 * `<img>` (position:absolute, inset:0) painted over it, and its row scroller
 * (`overflow-x:auto`, padding:0) clipped the scale(1.05) overhang. Both made the
 * ring invisible on a real remote even though its computed style was correct,
 * and no other Tizen gate could see it: grid-parity checks focus position and
 * check-contrast checks the color.
 *
 * See focus-ring.helper.ts for the probe contract.
 */

import { test, expect, waitForAppReady } from './fixtures';
import { expectNoOverhangClipping, expectRingPainted, probeFocusedCard } from './focus-ring.helper';

const ROW_SCROLLER = '.content-category__row';

test('home grid: focused card paints a ring on the poster layer at all four edges', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppReady(page);
  await expect(page.locator('#content-grid')).toBeVisible();

  // Focus the way the remote does: the element API, never the mouse, because
  // :hover shares the ring rule on this platform and would mask the defect.
  await page.locator('.content-card').first().focus();

  expectRingPainted(await probeFocusedCard(page, ROW_SCROLLER), 'tizen home');
});

test('home grid: the row scroller must not clip the focused card', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await page.locator('.content-card').first().focus();

  expectNoOverhangClipping(await probeFocusedCard(page, ROW_SCROLLER), 'tizen home');
});
