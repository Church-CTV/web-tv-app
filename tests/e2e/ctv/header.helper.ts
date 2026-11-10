import { test, expect, waitForAppReady } from './fixtures';
import mockFeed from '../../../shared/test-fixtures/mock-feed.json';

export function defineHeaderTests(): void {
  test('Home displays clean legacy sermon titles from the loaded feed', async ({ page }) => {
    const feed = JSON.parse(JSON.stringify(mockFeed));
    feed['July 2026'][0].title =
      String.raw`By Faith: Follow \\ Pastor Ken Bushey \\ September 27, 2026`;
    await page.route(/\/feed\/?$/, (route) => route.fulfill({ json: feed }));
    await page.goto('/');
    await waitForAppReady(page);
    await expect(page.locator('.grid-header__title,.focus-meta__title')).toHaveText(
      'By Faith: Follow · Pastor Ken Bushey · September 27, 2026'
    );
    await expect(page.locator('#content-grid .content-card').first()).toBeFocused();
  });
  for (const scale of [1, 2]) {
    test(`header and nav scale together at ${1920 * scale}x${1080 * scale}`, async ({ page }) => {
      await page.setViewportSize({ width: 1920 * scale, height: 1080 * scale });
      await page.goto('/');
      await waitForAppReady(page);
      for (const screen of ['Home', 'Search', 'Settings']) {
        if (screen !== 'Home') {
          await page.getByRole('button', { name: screen, exact: true }).click();
          await expect(page.locator(`#screen-${screen.toLowerCase()}`)).toHaveClass(
            /screen-active/
          );
        }
        const box = await page.evaluate(() => {
          const rect = (selector: string) =>
            document.querySelector(selector)!.getBoundingClientRect().toJSON();
          return {
            clock: rect('#overhang-clock'),
            logo: rect('.overhang-logo,.overhang__logo'),
            title: rect('.overhang-title,.overhang__title'),
            icon: rect('.left-nav__icon'),
            clockPainted: (() => {
              const clock = document.querySelector('#overhang-clock')!;
              const r = clock.getBoundingClientRect();
              return (
                document.elementsFromPoint(r.right - 30, r.top + 15).some((e) => e === clock) &&
                document.elementFromPoint(r.right - 30, r.top + 15) === clock
              );
            })(),
            logoPainted: (() => {
              const logo = document.querySelector('.overhang-logo,.overhang__logo')!;
              const r = logo.getBoundingClientRect();
              return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === logo;
            })(),
            logoLoaded: (
              document.querySelector('.overhang-logo,.overhang__logo') as HTMLImageElement
            ).naturalWidth,
          };
        });
        expect(box.clockPainted, `${screen} clock is above the active screen`).toBe(true);
        expect(box.logoPainted, `${screen} logo is above the rail and active screen`).toBe(true);
        expect(box.clock.right / scale).toBeCloseTo(1848, 0);
        expect(box.clock.top / scale).toBeCloseTo(38, 0);
        expect(box.logo.left / scale).toBeCloseTo(50, 0);
        expect(box.logo.width / scale).toBeCloseTo(240, 0);
        expect(box.logo.height / scale).toBeCloseTo(138, 0);
        expect(box.logoLoaded).toBeGreaterThanOrEqual(365);
        expect(box.title.left).toBeGreaterThanOrEqual(box.logo.right + 24 * scale);
        expect(box.title.right).toBeLessThanOrEqual(box.clock.left - 24 * scale);
        expect(box.icon.width / scale).toBeCloseTo(40, 0);
        expect(box.icon.height / scale).toBeCloseTo(40, 0);
      }
    });
  }
}
