/**
 * L-703: the production perf gate must stay strict AND noise-tolerant.
 *
 * Evidence (2026-10-27, run 40502514601 vs 40484950514): run `d60e04b` went red on
 * `perf-script-exec.spec.ts` with "PlatformI18n ... 161ms" and "median 567ms", while the
 * measured webOS chunk was byte-identical to the green run (`HomeScreen.DbXva5WG.js` in both).
 * The same unchanged bundle measures median 34 ms on an idle machine (one sample 150 ms)
 * and 567 ms on a loaded runner — an 8x spread from scheduling noise alone.
 *
 * The budgets themselves are pinned and are NOT the knob: `scriptExecMs: 300` and the
 * 100 ms per-script ceiling must not move. What has to be correct is the measurement:
 *
 *   1. The production project must not run its perf specs in parallel against each other.
 *      Two specs doing five full page loads each on `workers: 2` measure each other's CPU
 *      contention, not the bundle.
 *   2. The per-script ceiling must judge a per-script statistic across runs, exactly like
 *      the total budget already judges the median of five runs. Throwing on any single
 *      sample makes a 40 ms chunk fatal whenever the runner is busy.
 *
 * This gate asserts all three: measurement hardened, budgets untouched.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = resolve(__dirname, '../..');
const CONFIG_PATH = resolve(REPO, 'playwright.production.config.ts');
const SPEC_PATH = resolve(REPO, 'tests/e2e/production/perf-script-exec.spec.ts');
const BUDGETS_PATH = resolve(REPO, 'scripts/perf-budgets.json');

describe('L-703 production perf gate measurement robustness', () => {
  it('runs production perf specs one worker at a time', () => {
    // Strip comment lines first: prose must not be able to satisfy this gate.
    const src = readFileSync(CONFIG_PATH, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const workers = src.match(/\bworkers:\s*(\d+|process\.env\.[A-Z_]+)\b/);
    expect(workers, 'the production Playwright config must declare a worker count').toBeTruthy();
    expect(
      workers![1],
      `perf specs must not measure each other's CPU contention — expected workers: 1, found ${workers![1]}`
    ).toBe('1');
  });

  it('judges the per-script ceiling on a per-script median, not a single sample', () => {
    const src = readFileSync(SPEC_PATH, 'utf8');
    const perScript = src.slice(src.indexOf('no individual script exceeds'));
    expect(perScript.length, 'the per-script test must exist').toBeGreaterThan(0);
    expect(
      perScript,
      'the per-script test must aggregate repeated runs per script name before thresholding'
    ).toMatch(/median\s*\(/);
    expect(
      perScript,
      'a single slow sample must not be fatal: threshold on the aggregated statistic, not on raw samples'
    ).not.toMatch(/if\s*\(\s*samples\.length\s*>\s*0\s*\)\s*\{?\s*throw/);
  });

  it('keeps the pinned budgets unmoved while hardening the measurement', () => {
    const budgets = JSON.parse(readFileSync(BUDGETS_PATH, 'utf8')) as {
      webos: Record<string, number>;
    };
    expect(budgets.webos.scriptExecMs).toBe(300);
    const spec = readFileSync(SPEC_PATH, 'utf8');
    expect(
      spec,
      'the 100 ms per-script ceiling is a pinned budget; do not inflate it to absorb runner noise'
    ).toMatch(/const PER_SCRIPT_CEILING_MS = 100;/);
  });
});
