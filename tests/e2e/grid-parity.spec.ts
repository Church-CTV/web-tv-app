/**
 * Pinned Roku source authority: 528afc45e030520abd3f9ac6c4a3aed955595b83.
 * GridScreen.xml authors 480x270 cards, 30px spacing, RowList [150,300],
 * rowLabelOffset [75,30], focusXOffset 75 and 405px row pitch.
 * Web label line-box adaptation: label y330, poster y390. These positions
 * are web layout expectations, not a claim of device-measured Roku pixels.
 */

import { test, expect, waitForAppReady } from './fixtures';

/** Layout top/left in viewport coordinates for the 1st match of a selector.
 *  Uses getBoundingClientRect but removes the focus scale(1.05) offset, since
 *  the reference targets (label y=330, card y=390, pitch 510) are layout-box
 *  numbers. */
async function layoutPos(
  page: import('@playwright/test').Page,
  selector: string
): Promise<{ top: number; left: number }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    let sx = 1;
    let sy = 1;
    if (cs.transform && cs.transform !== 'none') {
      const m = new DOMMatrix(cs.transform);
      sx = m.a;
      sy = m.d;
    }
    // Scale is centered (default transform-origin), so the unscaled layout
    // box is inset half the size delta on each side.
    return {
      top: Math.round(r.top + ((sy - 1) * el.offsetHeight) / 2),
      left: Math.round(r.left + ((sx - 1) * el.offsetWidth) / 2),
    };
  }, selector);
}

/** Layout size from computed styles (transform-proof). */
async function layoutSize(
  page: import('@playwright/test').Page,
  selector: string
): Promise<{ w: number; h: number }> {
  return page.evaluate((sel) => {
    const cs = getComputedStyle(document.querySelector(sel) as HTMLElement);
    return { w: parseFloat(cs.width), h: parseFloat(cs.height) };
  }, selector);
}

test('Roku parity: home cards keep the 480x270 reference size and 510px pitch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await waitForAppReady(page);

  const size = await layoutSize(page, '#screen-grid .content-card');
  expect(Math.abs(size.w - 480)).toBeLessThanOrEqual(2);
  expect(Math.abs(size.h - 270)).toBeLessThanOrEqual(2);

  const [c1, c2] = await Promise.all([
    layoutPos(page, '#screen-grid .content-card:nth-child(1)'),
    layoutPos(page, '#screen-grid .content-card:nth-child(2)'),
  ]);
  expect(Math.abs(c2.left - c1.left - 510)).toBeLessThanOrEqual(2);
});

test('Roku parity: label at y=330, first row at y=390, focus line fixed at y=390', async ({
  page,
}) => {
  // The stock mock feed's content is shorter than the viewport, so its last
  // rows CANNOT reach the focus line (matching Roku: a RowList cannot scroll
  // past content end). Extend with two more months so mid-list rows exist.
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const feedFile = path.resolve(__dirname, '../../shared/test-fixtures/mock-feed.json');
  const feed = JSON.parse(await fs.readFile(feedFile, 'utf8'));
  feed['May 2026'] = feed['June 2026'].map((item: Record<string, unknown>) => ({
    ...item,
    id: `parity-may-${String(item.id)}`,
  }));
  feed['April 2026'] = feed['June 2026'].map((item: Record<string, unknown>) => ({
    ...item,
    id: `parity-apr-${String(item.id)}`,
  }));
  await page.route(/\/feed\/?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed) })
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await waitForAppReady(page);

  const label = await layoutPos(page, '#screen-grid .content-grid__row-title');
  expect(Math.abs(label.top - 330)).toBeLessThanOrEqual(6);

  const first = await layoutPos(page, '#screen-grid .content-card');
  expect(Math.abs(first.top - 390)).toBeLessThanOrEqual(6);

  // Move focus to row 1 and let the smooth scroll settle: the newly focused
  // row must come to rest on the same focus line, not merely become visible.
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(
    () => {
      const a = document.activeElement as HTMLElement | null;
      const rows = [...document.querySelectorAll('.content-grid__row-videos')];
      return (
        rows.length > 1 &&
        !!a?.closest?.('.content-card') &&
        rows[1].contains(a.closest('.content-card'))
      );
    },
    undefined,
    { timeout: 5000 }
  );
  // Converge: scrollIntoView(block:'start') + scroll-margin-top 90 targets
  // scrollTop == cardContentOffset - 90. The quantity
  // cardRect.top - vpRect.top + vp.scrollTop is scroll-invariant, so the
  // wait is a true convergence check (no heuristic identical-sample racing
  // against the smooth-scroll animation).
  await page.waitForFunction(
    () => {
      const vp = document.querySelector('#screen-grid .grid-viewport') as HTMLElement;
      const card = document.activeElement?.closest?.('.content-card') as HTMLElement | null;
      if (!vp || !card) return false;
      // Undo the focus zoom for the invariant (rect is scaled about the center).
      const m = new DOMMatrixReadOnly(getComputedStyle(card).transform);
      const rect = card.getBoundingClientRect();
      const correctedTop = rect.top + ((m.a - 1) * rect.height) / (2 * m.a);
      const needed = correctedTop - vp.getBoundingClientRect().top + vp.scrollTop - 90;
      return Math.abs(vp.scrollTop - Math.max(0, needed)) <= 2;
    },
    undefined,
    { timeout: 8000, polling: 100 }
  );
  const focused = await page.evaluate(() => {
    const card = (document.activeElement as HTMLElement).closest('.content-card') as HTMLElement;
    const r = card.getBoundingClientRect();
    const m = new DOMMatrix(getComputedStyle(card).transform);
    return Math.round(r.top + ((m.d - 1) * card.offsetHeight) / 2);
  });
  expect(Math.abs(focused - 390)).toBeLessThanOrEqual(6);
});

test('Roku parity: home and search cards are image-only (no title band)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await waitForAppReady(page);

  const homeTitle = await page.evaluate(
    () => getComputedStyle(document.querySelector('#screen-grid .content-card__title')!).display
  );
  expect(homeTitle).toBe('none');

  // Search: opening the screen must focus the query field (Roku parity),
  // and result cards must hide the title band too (same ContentCard style).
  // Nav entry parity: Left from the grid raises the CURRENT PAGE's icon
  // (Home), not the geometrically nearest icon.
  await page.keyboard.press('ArrowLeft');
  const navAria = await page.evaluate(
    () => document.activeElement?.getAttribute('aria-label') ?? ''
  );
  expect(navAria).toBe('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-search .search-screen__input')).toBeVisible();
  const focusedClass = await page.evaluate(
    () => (document.activeElement as HTMLElement)?.className ?? ''
  );
  expect(focusedClass).toContain('search-screen__input');

  await page.fill('#screen-search .search-screen__input', 'sermon');
  await expect(page.locator('#screen-search .content-card').first()).toBeVisible();
  const searchTitle = await page.evaluate(
    () => getComputedStyle(document.querySelector('#screen-search .content-card__title')!).display
  );
  expect(searchTitle).toBe('none');
});
