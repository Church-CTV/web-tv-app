/**
 * UX 1.2 — a rail that hides its scrollbar has to say that it continues.
 *
 * Samsung asks for a scroll or position indicator when content does not fit.
 * The rails here set `scrollbar-width: none`, so the only cue is the page
 * marker `shared/ui/ScrollIndicator.ts` draws. This spec proves it on a real
 * browser layout rather than in jsdom:
 *
 *   - the resting screen shows no marker (the cue appears when the viewer is
 *     inside a rail, not as permanent decoration over the artwork);
 *   - once the viewer pages right, exactly one marker is visible, it states a
 *     page out of a total, and it is announced to a screen reader;
 *   - a rail whose cards all fit says nothing.
 *
 * The fixture feed has three cards in a rail, which fits at this viewport, so
 * the test lengthens one rail with cloned real cards. Genuine layout matters
 * here: the marker is computed from measured widths, and a fixture that lies
 * about geometry would prove nothing.
 */

import { test, expect, waitForAppReady } from './fixtures';

/** Lengthen the first rail until it genuinely scrolls. Returns its geometry. */
async function makeRailScroll(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>(
      '.content-grid__row-videos, .content-category__row'
    );
    const card = rail?.querySelector<HTMLElement>('.content-card');
    if (!rail || !card) return null;
    while (rail.scrollWidth <= rail.clientWidth + 400) {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      rail.appendChild(clone);
      if (rail.querySelectorAll('.content-card').length > 40) break;
    }
    return {
      cards: rail.querySelectorAll('.content-card').length,
      scrollWidth: rail.scrollWidth,
      clientWidth: rail.clientWidth,
    };
  });
}

test('UX 1.2: the resting screen carries no page marker', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await expect(page.locator('.content-row__indicator--visible')).toHaveCount(0);
});

test('UX 1.2: paging a rail shows one marker that states the position', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const geometry = await makeRailScroll(page);
  expect(geometry, 'the app rendered no rail to measure').not.toBeNull();
  expect(geometry!.scrollWidth).toBeGreaterThan(geometry!.clientWidth);

  await page.evaluate(() => {
    const rail = document.querySelector('.content-grid__row-videos, .content-category__row');
    (rail?.querySelector('.content-card') as HTMLElement | null)?.focus();
  });
  // The marker follows the remote keys, because that is how a viewer moves:
  // the D-pad path scrolls the rail and updates the marker together.
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight', { delay: 50 });
  await page.waitForTimeout(400); // let the smooth scroll settle

  const marker = page.locator('.content-row__indicator--visible');
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveText(/^Page \d+ of \d+$/);
  const pages = Number(await marker.getAttribute('data-pages'));
  const page1 = Number(await marker.getAttribute('data-page'));
  expect(pages).toBeGreaterThanOrEqual(2);
  expect(page1).toBeGreaterThanOrEqual(1);
  expect(page1).toBeLessThanOrEqual(pages);
  // A cue only a sighted person can see is half a cue.
  await expect(marker).toHaveAttribute('role', 'status');
  await expect(marker).toHaveAttribute('aria-live', 'polite');
});

test('UX 1.2: a rail whose cards all fit says nothing', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>(
      '.content-grid__row-videos, .content-category__row'
    );
    if (!rail) return;
    // Shorten the rail to what fits, then focus inside it.
    for (const card of Array.from(rail.querySelectorAll('.content-card')).slice(0, 2)) {
      card.remove();
    }
    (rail.querySelector('.content-card') as HTMLElement | null)?.focus();
  });
  await page.keyboard.press('ArrowRight', { delay: 50 });
  await page.waitForTimeout(200);

  const visible = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('.content-row__indicator')).filter(
        (el) => el.classList.contains('content-row__indicator--visible') && el.textContent
      ).length
  );
  expect(visible, 'a rail with nothing hidden should not advertise pages').toBe(0);
});
