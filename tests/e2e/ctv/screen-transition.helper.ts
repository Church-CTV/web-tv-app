/**
 * L1b: Screen transition and key-to-paint performance budget tests.
 *
 * Shared across all three platforms (webOS / Tizen / Vizio). Called from
 * per-platform spec files (webos-screen-transition.spec.ts, etc.) so each
 * platform runs against its own vite preview origin via playwright.ctv.config.ts.
 *
 * Measurement approach:
 * - Use `page.evaluate` to run timing code inside the browser.
 * - Raw DOM `click()` bypasses Playwright stability/action checks so we measure
 *   the actual app response, not the test harness overhead.
 * - Poll every ~1ms for the target screen to become `screen-active`, timed
 *   against the click moment — reflects user-perceived latency.
 * - Take the median of 5 runs to reduce noise.
 * - Budgets live in scripts/perf-budgets.json (fail-closed CI gate).
 *
 * Measured baselines (local, warm cache, 5 runs each):
 * - webOS home→search: median 3.5ms, max 9.9ms
 * - webOS key→paint:   median 2.3-3.4ms, max 9.9ms
 * - tizen/vizio:       median 0.2-0.4ms, max 0.6ms
 * Budgets (150ms) are 15x+ above observed max, sized to fail only on
 * real regressions (lazy-chunk load failures, blocking work, etc).
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUDGETS_PATH = path.join(REPO_ROOT, 'scripts', 'perf-budgets.json');
const RUNS = 5;
const POLL_TIMEOUT_MS = 1500;

function readBudgets(): { screenTransitionMs: number; keyToPaintMs: number } {
  const raw = fs.readFileSync(BUDGETS_PATH, 'utf-8');
  const budgets = JSON.parse(raw) as {
    webos?: { screenTransitionMs?: number; keyToPaintMs?: number };
  };
  const platform = budgets.webos ?? {};
  return {
    screenTransitionMs: platform.screenTransitionMs ?? 150,
    keyToPaintMs: platform.keyToPaintMs ?? 150,
  };
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Load the home page and wait for it to be interactive.
 * Uses a robust ready check: home grid active, loading screen not active,
 * at least one content card rendered. Then settles briefly.
 */
async function loadHomePage(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => {
      const grid = document.querySelector('#screen-grid');
      const loading = document.querySelector('#screen-loading');
      return (
        grid?.classList.contains('screen-active') === true &&
        !loading?.classList.contains('screen-active') &&
        document.querySelectorAll('#content-grid .content-card').length > 0
      );
    },
    { timeout: 20000 }
  );
  await page.waitForTimeout(200);
}

/**
 * Measure home→search transition latency via raw DOM click.
 * Returns latency in ms, or -1 if the screen never became visible.
 */
async function measureHomeToSearch(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(async (pollTimeoutMs: number) => {
    const btn = [...document.querySelectorAll<HTMLButtonElement>('.left-nav__item')].find((el) =>
      el.textContent?.includes('Search')
    );
    if (!btn) return -1;

    const t0 = performance.now();
    btn.click();

    const deadline = performance.now() + pollTimeoutMs;
    while (performance.now() < deadline) {
      if (document.querySelector('#screen-search')?.classList.contains('screen-active')) {
        return performance.now() - t0;
      }
      await new Promise((r) => setTimeout(r, 1));
    }
    return -1;
  }, POLL_TIMEOUT_MS);
}

/**
 * Measure key-to-paint latency (Enter → settings screen).
 * On CTV remotes, OK/Enter activates the focused button, which is
 * functionally identical to a click for screen-transition timing.
 * Returns latency in ms, or -1 if the screen never became visible.
 */
async function measureKeyToPaint(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(async (pollTimeoutMs: number) => {
    const settingsEl = [...document.querySelectorAll<HTMLButtonElement>('.left-nav__item')].find(
      (el) => el.textContent?.includes('Settings')
    );
    if (!settingsEl) return -1;
    settingsEl.focus();

    const t0 = performance.now();
    settingsEl.click();

    const deadline = performance.now() + pollTimeoutMs;
    while (performance.now() < deadline) {
      if (document.querySelector('#screen-settings')?.classList.contains('screen-active')) {
        return performance.now() - t0;
      }
      await new Promise((r) => setTimeout(r, 1));
    }
    return -1;
  }, POLL_TIMEOUT_MS);
}

export function defineScreenTransitionTests(platform: string) {
  test.describe(`L1b: ${platform} screen transition and key-to-paint budgets`, () => {
    test('screen transition (home → search) within budget', async ({ page }) => {
      const { screenTransitionMs } = readBudgets();
      const samples: number[] = [];

      for (let i = 0; i < RUNS; i++) {
        await loadHomePage(page);
        const latency = await measureHomeToSearch(page);
        if (latency < 0) throw new Error('Search screen did not become visible after 1500ms');
        samples.push(latency);
      }

      const med = median(samples);
      console.log(
        `  [perf] ${platform} home→search: samples=[${samples.map((s) => s.toFixed(1)).join(', ')}]ms (median ${med.toFixed(1)}ms, budget ${screenTransitionMs}ms)`
      );
      expect(
        med,
        `${platform} home→search transition ${med.toFixed(1)}ms exceeds budget ${screenTransitionMs}ms`
      ).toBeLessThan(screenTransitionMs);
    });

    test('key-to-paint (Enter → settings screen) within budget', async ({ page }) => {
      const { keyToPaintMs } = readBudgets();
      const samples: number[] = [];

      for (let i = 0; i < RUNS; i++) {
        await loadHomePage(page);
        const latency = await measureKeyToPaint(page);
        if (latency < 0) throw new Error('Settings screen did not become visible after 1500ms');
        samples.push(latency);
      }

      const med = median(samples);
      console.log(
        `  [perf] ${platform} key→paint: samples=[${samples.map((s) => s.toFixed(1)).join(', ')}]ms (median ${med.toFixed(1)}ms, budget ${keyToPaintMs}ms)`
      );
      expect(
        med,
        `${platform} key-to-paint ${med.toFixed(1)}ms exceeds budget ${keyToPaintMs}ms`
      ).toBeLessThan(keyToPaintMs);
    });
  });
}
