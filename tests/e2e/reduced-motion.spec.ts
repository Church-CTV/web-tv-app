/**
 * K3a — Reduced motion E2E test (WCAG 2.3.3).
 *
 * Emulates prefers-reduced-motion: reduce and verifies the app honors it:
 *   - Screen fade transitions are reduced to 0.01ms (effectively instant).
 *   - Hover/focus micro-transitions on interactive cards/buttons are reduced.
 *   - A @media (prefers-reduced-motion: reduce) rule is present in the CSS.
 *
 * This is a hard CI gate: if the reduced-motion CSS is removed, these tests fail.
 *
 * Run: npx playwright test tests/e2e/reduced-motion.spec.ts
 */

import { test, expect, waitForAppReady } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * True when every value in a computed transition-duration list is effectively
 * instant (≤ 0.02s). Browsers may report the reduced 0.01ms in scientific
 * notation ("1e-05s"), so parse numerically rather than string-comparing.
 */
function allDurationsReduced(transitionDuration: string): boolean {
  return transitionDuration
    .split(',')
    .map((d) => {
      const m = d.trim().match(/([0-9.e+-]+)s/);
      return m ? parseFloat(m[1]) : NaN;
    })
    .every((s) => !Number.isNaN(s) && s <= 0.02);
}

/**
 * Whether a prefers-reduced-motion media rule exists in the loaded stylesheets.
 */
async function hasReducedMotionRule(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin / opaque sheet
      }
      for (const rule of rules) {
        if (
          rule instanceof CSSMediaRule &&
          rule.conditionText &&
          rule.conditionText.includes('prefers-reduced-motion')
        ) {
          return true;
        }
      }
    }
    return false;
  });
}

test.describe('Reduced motion (WCAG 2.3.3)', () => {
  // Emulate the OS-level reduced motion preference for every test below.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('screen fade transition is near-instant under reduced motion', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const { transitionDuration } = await page.locator('#screen-grid').evaluate((el) => ({
      transitionDuration: window.getComputedStyle(el).transitionDuration,
    }));

    expect(
      allDurationsReduced(transitionDuration),
      `Screen transition-duration should be 0.01ms under prefers-reduced-motion (got: ${transitionDuration})`
    ).toBe(true);
  });

  test('content-card hover transition is reduced under reduced motion', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const card = page.locator('.content-card').first();
    const { transitionDuration } = await card.evaluate((el) => ({
      transitionDuration: window.getComputedStyle(el).transitionDuration,
    }));

    expect(
      allDurationsReduced(transitionDuration),
      `Content card transition-duration should be 0.01ms under prefers-reduced-motion (got: ${transitionDuration})`
    ).toBe(true);
  });

  test('reduced-motion media rule is present in app CSS', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    expect(
      await hasReducedMotionRule(page),
      '@media (prefers-reduced-motion: reduce) rule must exist in app CSS'
    ).toBe(true);
  });
});
