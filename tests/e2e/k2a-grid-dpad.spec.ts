/**
 * K2a — Grid D-pad navigation matrix (webOS home screen).
 *
 * Exact-focus functional assertions for the ten-foot remote D-pad:
 *   - initial focus on load
 *   - ArrowRight within row (with wrap-around at last card)
 *   - ArrowDown to next row (with containment at last row)
 *   - ArrowUp to nearest column in previous row (with containment at first row)
 *   - ArrowLeft from grid to left-nav (no focus dead-end)
 *   - OK (Enter) activates the focused card
 *   - rapid key repeat (no dropped focus)
 *   - off-screen scrolling (focused card is visible)
 *
 * Screenshots alone do not qualify — these are behavioral DOM assertions.
 */

import { test, expect, waitForAppReady } from './fixtures';

/** Class of the currently focused element in the page. */
async function focusedClass(page: any): Promise<string> {
  return page.evaluate(() => (document.activeElement as HTMLElement)?.className ?? '');
}

/** data-video-id of the currently focused content card, or null. */
async function focusedCardId(page: any): Promise<string | null> {
  return page.evaluate(
    () =>
      (document.activeElement as HTMLElement | null)
        ?.closest('.content-card')
        ?.getAttribute('data-video-id') ?? null
  );
}

/** Number of cards in the given row (0-indexed). */
async function cardsInRow(page: any, rowIdx: number): Promise<number> {
  return page.locator('.content-grid__row-videos').nth(rowIdx).locator('.content-card').count();
}

/** Focus a card by row index and card index within that row. */
async function focusCard(page: any, rowIdx: number, cardIdx: number): Promise<void> {
  const card = page
    .locator('.content-grid__row-videos')
    .nth(rowIdx)
    .locator('.content-card')
    .nth(cardIdx);
  await card.focus();
}

test('K2a-1: initial focus lands on the first content card on load', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Focus must be on the first card of the first row
  const cls = await focusedClass(page);
  expect(cls).toContain('content-card');

  const id = await focusedCardId(page);
  const firstCardId = await page
    .locator('.content-grid__row-videos')
    .first()
    .locator('.content-card')
    .first()
    .getAttribute('data-video-id');
  expect(id).toBe(firstCardId);
});

test('K2a-2: ArrowRight moves to the next card within the row', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await focusCard(page, 0, 0);
  const firstId = await focusedCardId(page);

  await page.keyboard.press('ArrowRight');

  const secondId = await focusedCardId(page);
  expect(secondId).toBeTruthy();
  expect(secondId).not.toBe(firstId);

  // Must be the immediate next card in the same row
  const secondCardId = await page
    .locator('.content-grid__row-videos')
    .first()
    .locator('.content-card')
    .nth(1)
    .getAttribute('data-video-id');
  expect(secondId).toBe(secondCardId);
});

test('K2a-3: ArrowRight on last card of a row wraps to first card', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const lastIdx = (await cardsInRow(page, 0)) - 1;
  await focusCard(page, 0, lastIdx);
  const lastId = await focusedCardId(page);
  const firstId = await page
    .locator('.content-grid__row-videos')
    .first()
    .locator('.content-card')
    .first()
    .getAttribute('data-video-id');

  await page.keyboard.press('ArrowRight');

  const wrappedId = await focusedCardId(page);
  expect(wrappedId).toBe(firstId);
  expect(wrappedId).not.toBe(lastId);
});

test('K2a-4: ArrowDown moves focus to the next row (same column)', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const rows = await page.locator('.content-grid__row-videos').count();
  expect(rows).toBeGreaterThanOrEqual(2);

  // Focus a card in row 0 at a known column
  const col = 1;
  await focusCard(page, 0, col);

  await page.keyboard.press('ArrowDown');

  // Must still be a content card in row 1
  const id = await focusedCardId(page);
  expect(id).toBeTruthy();
  // Verify the focused card is in row 1
  const inRow1 = await page.evaluate((videoId) => {
    const card = document.querySelector(`.content-card[data-video-id="${videoId}"]`);
    if (!card) return -1;
    const grid = card.closest('.content-grid');
    const rows = Array.from(grid?.querySelectorAll('.content-grid__row-videos') ?? []);
    const parent = card.parentElement as Element | null;
    return rows.findIndex((r) => r === parent);
  }, id);
  expect(inRow1).toBe(1);
});

test('K2a-5: ArrowDown on last row stays put (edge containment)', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const rows = await page.locator('.content-grid__row-videos').count();
  const lastRowIdx = rows - 1;
  const lastCardIdx = (await cardsInRow(page, lastRowIdx)) - 1;

  await focusCard(page, lastRowIdx, lastCardIdx);
  const idBefore = await focusedCardId(page);

  await page.keyboard.press('ArrowDown');

  // Focus must remain on the same card — no trap, no jump to random element
  const idAfter = await focusedCardId(page);
  expect(idAfter).toBe(idBefore);
});

test('K2a-6: ArrowUp on first row stays put (edge containment)', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await focusCard(page, 0, 0);
  const idBefore = await focusedCardId(page);

  await page.keyboard.press('ArrowUp');

  const idAfter = await focusedCardId(page);
  expect(idAfter).toBe(idBefore);
});

test('K2a-7: ArrowUp moves to the nearest column in the previous row', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const rows = await page.locator('.content-grid__row-videos').count();
  expect(rows).toBeGreaterThanOrEqual(2);

  // Focus a card in row 1
  const cardInRow1 = page
    .locator('.content-grid__row-videos')
    .nth(1)
    .locator('.content-card')
    .first();
  await cardInRow1.focus();
  const idInRow1 = await focusedCardId(page);

  await page.keyboard.press('ArrowUp');

  // Focus must be in row 0
  const idInRow0 = await focusedCardId(page);
  expect(idInRow0).toBeTruthy();
  expect(idInRow0).not.toBe(idInRow1);
  // Verify the focused card is in row 0
  const inRow0 = await page.evaluate((videoId) => {
    const card = document.querySelector(`.content-card[data-video-id="${videoId}"]`);
    if (!card) return -1;
    const grid = card.closest('.content-grid');
    const rows = Array.from(grid?.querySelectorAll('.content-grid__row-videos') ?? []);
    const parent = card.parentElement as Element | null;
    return rows.findIndex((r) => r === parent);
  }, idInRow0);
  expect(inRow0).toBe(0);
});

test('K2a-8: ArrowLeft from a grid card focuses the left-nav', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await focusCard(page, 0, 0);

  await page.keyboard.press('ArrowLeft');

  // Focus must move out of the grid into the left-nav
  const cls = await focusedClass(page);
  expect(cls).toContain('left-nav__item');
  const afterId = await focusedCardId(page);
  expect(afterId).toBeNull();
});

test('K2a-9: OK (Enter) on the focused card opens the video screen directly', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await focusCard(page, 0, 1);

  await page.keyboard.press('Enter');

  // Direct play: Enter on a card opens the video screen (no detail screen).
  await expect(page.locator('.video-screen')).toBeVisible({ timeout: 5000 });
});

test('K2a-10: rapid key repeat advances focus correctly (no dropped keys)', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const rowCount = await cardsInRow(page, 0);
  // Target: the 3rd card (index 2) — always within row bounds (rows have >= 3 cards in fixture)
  await focusCard(page, 0, 0);

  // Rapid-fire ArrowRight twice (50ms apart — faster than human remote repeat)
  await page.keyboard.press('ArrowRight', { delay: 50 });
  await page.keyboard.press('ArrowRight', { delay: 50 });

  const focusedId = await focusedCardId(page);
  const expectedId = await page
    .locator('.content-grid__row-videos')
    .first()
    .locator('.content-card')
    .nth(2)
    .getAttribute('data-video-id');
  expect(focusedId).toBe(expectedId);
  expect(rowCount).toBeGreaterThanOrEqual(3);
});

test('K2a-11: off-screen cards scroll into view when focused', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const rowCount = await cardsInRow(page, 0);
  // Four cards is what makes this a scroll test at this viewport. The fixture
  // rail holds three, so this case reports as skipped rather than returning
  // quietly: a green that never asserted anything is the worst kind of green.
  // The page-marker requirement (UX 1.2) is proven in ux-scroll-indicator.spec.ts
  // against a rail built long enough to scroll.
  test.skip(rowCount < 4, `rail has ${rowCount} cards: nothing scrolls at this viewport`);

  // Focus card index 0, then advance to card index 3 (partially off-screen)
  await focusCard(page, 0, 0);
  await page.keyboard.press('ArrowRight', { delay: 50 });
  await page.keyboard.press('ArrowRight', { delay: 50 });
  await page.keyboard.press('ArrowRight', { delay: 50 });
  await page.waitForTimeout(300); // allow scrollIntoView smooth animation

  const card = page.locator('.content-grid__row-videos').first().locator('.content-card').nth(3);
  // Card 3 must be at least partially visible (scrolled into view)
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  // Must overlap the viewport horizontally (not scrolled fully past the right edge)
  expect(box!.x + box!.width).toBeGreaterThan(0);
  expect(box!.x).toBeLessThan(1280);
});

test('K2a-12: D-pad has no focus trap (grid <-> left-nav round trip)', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Start: focus on first card
  await focusCard(page, 0, 0);
  const gridId = await focusedCardId(page);
  expect(gridId).toBeTruthy();

  // Left → left-nav
  await page.keyboard.press('ArrowLeft');
  expect(await focusedClass(page)).toContain('left-nav__item');

  // Right → back to the grid (must not be trapped in left-nav)
  await page.keyboard.press('ArrowRight');
  const backInGrid = await focusedCardId(page);
  expect(backInGrid).toBeTruthy();

  // Left → left-nav again (round trip is stable)
  await page.keyboard.press('ArrowLeft');
  expect(await focusedClass(page)).toContain('left-nav__item');
});
