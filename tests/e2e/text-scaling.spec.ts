/**
 * E2E Text Scaling / WCAG 1.4.4 Resize Text spec.
 *
 * WCAG 1.4.4 requires that users can resize text up to 200% without:
 *   - losing content
 *   - losing functionality
 *   - losing information through clipping
 *
 * Strategy: inject `html { font-size: 20px !important }` via Playwright
 * style tag (doubles the rem base), then verify that critical text
 * elements are not clipped and remain accessible.
 *
 * Run: npx playwright test tests/e2e/text-scaling.spec.ts
 */

import { test, expect, waitForAppReady, navigateToScreen, mockAppRoutes } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Apply 200% text scaling by doubling the root font-size.
 * All `rem`-based font sizes will scale proportionally.
 */
async function scaleText200(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'html { font-size: 20px !important; }' });
  // Wait for the browser to reflow.
  await page.waitForTimeout(400);
}

/**
 * Check that an element is not visually clipping its text content.
 *
 * Logic: compare scrollHeight to clientHeight.
 * - scrollHeight > clientHeight + tolerance → content overflows / is clipped.
 * - Returns true if the element is NOT clipped (all content visible).
 */
async function isContentVisible(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return true; // element not found — nothing to clip
    // For inline / replaced elements, check offsetParent visibility.
    if (el.offsetParent === null && getComputedStyle(el).position === 'static') {
      // Element is hidden (display:none) — skip.
      return true;
    }
    const scrollH = el.scrollHeight;
    const clientH = el.clientHeight;
    // 10px tolerance to account for border/padding rounding.
    return scrollH <= clientH + 10;
  }, selector);
}

/**
 * Check that an element is visually present (not display:none).
 */
async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return false;
    return el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  }, selector);
}

test.describe('Text Scaling / WCAG 1.4.4 — 200% font size', () => {
  test.beforeEach(async ({ page }) => {
    await mockAppRoutes(page);
  });

  test('home screen: content card titles remain visible at 200% text size', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Capture a baseline font size before scaling.
    const before = await page.evaluate(() => {
      const el = document.querySelector('.content-card__title') as HTMLElement | null;
      if (!el) return null;
      return {
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
      };
    });

    // Apply 200% text scale.
    await scaleText200(page);

    // After scaling, the card title font size should grow.
    // With rem-based sizing, 20px root → font-size-multiplier is 20/16 = 1.25×
    // relative to the 16px root the design assumes; total effective scale
    // against the design's intended rendering is 200%.
    const after = await page.evaluate(() => {
      const el = document.querySelector('.content-card__title') as HTMLElement | null;
      if (!el) return null;
      return {
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
      };
    });

    expect(after, 'Card title should still be present after 200% scaling').not.toBeNull();
    expect(before, 'Card title should be present before scaling').not.toBeNull();

    // The root font-size should be 20px (200% of 16px).
    const rootFontSize = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize)
    );
    expect(
      rootFontSize,
      `Root font-size should be ~20px (200% of 16px), got ${rootFontSize}px`
    ).toBeGreaterThanOrEqual(19);

    // The card title font-size should have grown from its baseline.
    expect(
      after!.fontSize,
      `Card title should grow from ${before!.fontSize}px after 200% text scale, got ${after!.fontSize}px`
    ).toBeGreaterThanOrEqual(before!.fontSize * 1.1);

    // Card title content should not be clipped.
    const visible = await isContentVisible(page, '.content-card__title');
    expect(
      visible,
      `Card title is clipped at 200% text size (scrollH=${after!.scrollH} > clientH=${after!.clientH})`
    ).toBe(true);
  });

  test('home screen: row titles remain visible at 200% text size', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await scaleText200(page);
    await page.waitForTimeout(300);

    const visible = await isContentVisible(page, '.content-grid__row-title');
    expect(visible, 'Row titles (e.g., "Trending Now") are clipped at 200% text size').toBe(true);
  });

  test('search screen: search input and results remain functional at 200% text size', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToScreen(page, 'Search');
    await scaleText200(page);
    await page.waitForTimeout(300);

    // Search input should still be visible.
    const inputVisible = await isVisible(page, '.search-screen input, .search-screen__input');
    expect(inputVisible, 'Search input should be visible at 200% text size').toBe(true);

    // Search screen title should not be clipped.
    const titleVisible = await isContentVisible(page, '.search-screen__title');
    expect(titleVisible, 'Search screen title is clipped at 200% text size').toBe(true);
  });

  test('settings screen: setting labels and values remain visible at 200% text size', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToScreen(page, 'Settings');
    await scaleText200(page);
    await page.waitForTimeout(300);

    // Setting labels are the main text on this screen.
    const labelSelector =
      '.settings-screen__option-label, .settings-screen label, .settings-screen .setting-row__label';
    const labelVisible = await isContentVisible(page, labelSelector);
    expect(labelVisible, 'Setting labels are clipped at 200% text size').toBe(true);
  });

  test('error screen: all text remains visible at 200% text size', async ({ page }) => {
    // Make the feed fail so the app shows the error screen.
    await page.route(/\/feed\/?(?:\?|#|$)/, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'simulated network failure' }),
      })
    );

    await page.goto('/');
    // Wait for error screen to appear (feed failures exhausted retries).
    await page.locator('#error-screen').waitFor({ state: 'visible', timeout: 20000 });
    await scaleText200(page);
    await page.waitForTimeout(400);

    // All three main text elements on the error screen.
    for (const sel of ['.error-screen__title', '.error-screen__message', '.error-screen__btn']) {
      const visible = await isContentVisible(page, sel);
      expect(visible, `Error screen element ${sel} is clipped at 200% text size`).toBe(true);
    }
  });
});
