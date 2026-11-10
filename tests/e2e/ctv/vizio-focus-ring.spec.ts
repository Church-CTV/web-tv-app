/**
 * E2E: the Vizio home grid must PAINT a focus ring (project `vizio`, :4182).
 *
 * Vizio's stylesheet (platforms/vizio/src/styles.css) was 13 lines of @import
 * and nothing else: zero `:focus` rules of its own. So a focused card got only
 * the shared rule (shared/styles/components.css L17-22), which scales the card
 * and draws `outline: 3px solid var(--color-focus)` on `.content-card` itself.
 * Because the shared poster `<img>` is `position:absolute; inset:0` it paints
 * over that outline, so on a real remote the focused card enlarged with no ring
 * at all. Every existing Vizio gate checked position, a11y or contrast, never
 * paint, so the gap was invisible to CI.
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

  // Element-API focus only: a mouse hover would light up the shared :hover rule
  // and hide a focus-only regression.
  await page.locator('.content-card').first().focus();

  expectRingPainted(await probeFocusedCard(page, ROW_SCROLLER), 'vizio home');
});

test('home grid: the row scroller must not clip the focused card', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await page.locator('.content-card').first().focus();

  expectNoOverhangClipping(await probeFocusedCard(page, ROW_SCROLLER), 'vizio home');
});
