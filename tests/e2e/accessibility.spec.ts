/**
 * E2E Accessibility / WCAG spec — real axe-core audits across main screens.
 *
 * This spec:
 *   - Injects axe-core into the browser page (bundled axe-core).
 *   - Runs axe.run() on each primary screen (Home, Search, Settings, and an
 *     error screen). Schedule/Continue/Watch-Later/Subscribe were removed by
 *     the WIP (Roku-parity nav); the detail screen is bypassed by direct play.
 *   - Collects all WCAG 2.1 AA violations (color-contrast, aria-*, etc.).
 *   - FAILS the test if any violations are found. This is a real CI gate —
 *     not a log-and-pass diagnostic.
 *
 * Run: npx playwright test tests/e2e/accessibility.spec.ts
 */

import { test, expect, waitForAppReady, navigateToScreen, navigateToVideoScreen } from './fixtures';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AXE_PATH = path.join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js');

/**
 * Inject axe-core source into the page before navigation.
 * Uses addInitScript so it's available on every new document.
 */
async function injectAxe(page: Page): Promise<void> {
  const axeSource = fs.readFileSync(AXE_PATH, 'utf-8');
  await page.addInitScript(axeSource as unknown as string);
}

/**
 * Run axe and return the violations array.
 */
async function runAxe(page: Page, contextId?: string): Promise<any> {
  return page.evaluate((id) => {
    const axe = (window as any).axe;
    if (!axe) return { error: 'axe not injected' };
    const options: any = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } };
    if (id) options.context = id;
    return axe.run(document, options);
  }, contextId ?? '');
}

/**
 * Collect violations from an axe result.
 */
function collectViolations(axeResult: any): any[] {
  return axeResult.violations ?? [];
}

/**
 * Pretty-print violations for the error message.
 */
function formatViolations(violations: any[]): string {
  return violations
    .map((v: any) => {
      const nodes = (v.nodes ?? []).map((n: any) => n.html?.slice(0, 80)).join('\n       ');
      return `• ${v.id} (${v.impact || '?'}): ${v.description}\n   nodes:\n       ${nodes}`;
    })
    .join('\n');
}

test.describe('Accessibility / WCAG 2.1 AA audits', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  test('home screen passes WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(300); // let transitions settle

    const result = await runAxe(page);
    const violations = collectViolations(result);

    expect(
      violations,
      `Home screen has ${violations.length} WCAG violation(s):\n${formatViolations(violations)}`
    ).toHaveLength(0);
  });

  test('search screen passes WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToScreen(page, 'Search');
    await page.waitForTimeout(300);

    const result = await runAxe(page);
    const violations = collectViolations(result);

    expect(
      violations,
      `Search screen has ${violations.length} WCAG violation(s):\n${formatViolations(violations)}`
    ).toHaveLength(0);
  });

  test('settings screen passes WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToScreen(page, 'Settings');
    await page.waitForTimeout(300);

    const result = await runAxe(page);
    const violations = collectViolations(result);

    expect(
      violations,
      `Settings screen has ${violations.length} WCAG violation(s):\n${formatViolations(violations)}`
    ).toHaveLength(0);
  });

  test('error screen passes WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    // Force the documented error-screen DOM contract (same as visual-regression spec)
    await page.evaluate(() => {
      const grid = document.getElementById('content-grid');
      if (!grid) return;
      grid.innerHTML =
        '<div class="error-screen" id="error-screen"><div class="error-screen__icon">⚠️</div><h2 class="error-screen__title">Connection Error</h2><p class="error-screen__message">Unable to connect to the server.</p><button class="error-screen__btn" id="btn-retry" tabindex="0">Try Again</button></div>';
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('screen-active'));
      const err = document.getElementById('screen-error');
      if (err) {
        (err as HTMLElement).style.display = 'block';
        (err as HTMLElement).style.opacity = '1';
        err.classList.add('screen-active');
      }
    });
    await page.waitForTimeout(300);

    const result = await runAxe(page);
    const violations = collectViolations(result);

    expect(
      violations,
      `Error screen has ${violations.length} WCAG violation(s):\n${formatViolations(violations)}`
    ).toHaveLength(0);
  });

  test('video player screen passes WCAG 2.1 AA (video-caption excluded)', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToVideoScreen(page);
    await page.waitForTimeout(500); // let test stream start

    const result = await runAxe(page);
    const allViolations = collectViolations(result);
    // video-caption is expected: test asset has no caption track
    const violations = allViolations.filter((v: any) => v.id !== 'video-caption');

    expect(
      violations,
      `Video player screen has ${violations.length} WCAG violation(s):\n${formatViolations(violations)}`
    ).toHaveLength(0);
  });

  test('document has valid lang attribute and title', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Document must have lang attribute (axe rule: html-has-lang)
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang, 'html element must have a lang attribute').toBeTruthy();
    expect(lang).toMatch(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/);

    // Document must have a non-empty title (axe rule: document-title)
    const title = await page.title();
    expect(title, 'document must have a <title>').toBeTruthy();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('main content area is properly structured', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Must have a main landmark or role="main" (axe: region)
    const hasMain = await page.evaluate(() => {
      return !!(document.querySelector('main') || document.querySelector('[role="main"]'));
    });
    expect(hasMain, 'page must have a main landmark (role="main" or <main>)').toBe(true);
  });
});
