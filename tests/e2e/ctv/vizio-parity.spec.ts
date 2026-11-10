import { test, expect, waitForAppReady } from './fixtures';
import feed from '../../../shared/test-fixtures/mock-feed.json';

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
]) {
  test(`pinned Roku geometry at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const longFeed = {
      ...feed,
      'July 2026': Array.from({ length: 9 }, (_, index) => ({
        ...feed['July 2026'][0],
        id: `roku-${index}`,
      })),
    };
    await page.route(/\/feed\/?$/, (route) => route.fulfill({ json: longFeed }));
    await page.goto('/');
    await waitForAppReady(page);
    const geometry = await page
      .locator('.content-card')
      .first()
      .evaluate((card) => {
        const el = card as HTMLElement;
        const row = el.parentElement!;
        return {
          width: el.offsetWidth,
          height: el.offsetHeight,
          gap: parseFloat(getComputedStyle(row).gap),
          scrolls: row.scrollWidth > row.clientWidth,
        };
      });
    expect(geometry).toEqual({ width: 480, height: 270, gap: 30, scrolls: true });
    const scrollLeft = await page
      .locator('.content-category__row')
      .first()
      .evaluate((row) => {
        row.scrollLeft = 400;
        return row.scrollLeft;
      });
    expect(scrollLeft).toBeGreaterThan(0);
    await page
      .locator('.content-category__row')
      .first()
      .evaluate((row) => {
        row.scrollLeft = 0;
      });
    await page.getByRole('button', { name: 'Home', exact: true }).focus();
    await expect
      .poll(async () => (await page.locator('.content-card').first().boundingBox())?.width)
      .toBeCloseTo((480 * viewport.width) / 1920, 0);
    await page.locator('.content-card').first().focus();
    await expect(page.locator('.content-card').first()).toBeFocused();
  });
}

test('Roku Search and Settings surfaces remain accessible beside the persistent rail', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.locator('.osk-key[data-key="q"]').click();
  await expect(page.getByRole('searchbox')).toHaveValue('q');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-give__link')).toBeFocused();
  await expect(page.locator('.settings-channel')).toContainText('Channel:');
  await expect(page.locator('#left-nav')).toBeVisible();
  await expect(page.locator('.left-nav__item')).toHaveCount(3);
});

test('Roku header logo paints above the rail', async ({ page }) => {
  await page.goto('/');
  const logo = page.locator('.overhang-logo');
  await expect(logo).toBeVisible();
  const uncovered = await logo.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
  });
  expect(uncovered).toBe(true);
});
