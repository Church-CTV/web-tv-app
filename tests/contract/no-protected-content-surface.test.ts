/**
 * Owner decision 2026-11-09: "No protected content."
 *
 * That closes `WEB-033` (enforce entitlement before protected playback) by scope, not by
 * implementation: there is nothing to gate, so there is nothing to enforce. It also means
 * the entitlement machinery that was already in the tree was worse than dead - `core/src/entitlement/`
 * was an orphan (not exported from the core barrel, imported by no platform, exercised only
 * by its own test) while looking like a half-built paywall, and `GET /api/entitlement` in the
 * reference service kept contract fixtures implying the client consumes entitlement state.
 *
 * So the surface is deleted here and then pinned, in the same way the subscription surface is
 * pinned in `no-subscription-surface.test.ts`: a future contributor who adds an entitlement
 * path is contradicting a recorded owner decision, and this file is what makes that loud.
 *
 * Class of check differs per assertion on purpose: exports and fixtures are runtime facts;
 * a route in a reference service and a word in a platform source tree only exist as text.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { EN, ES } from '../../core/src/i18n/I18n';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function filesNamed(dir: string, pattern: RegExp): string[] {
  return walk(path.join(REPO_ROOT, dir))
    .filter((f) => pattern.test(path.basename(f)))
    .map((f) => path.relative(REPO_ROOT, f));
}

function sourcesMentioning(dir: string, pattern: RegExp): string[] {
  return walk(path.join(REPO_ROOT, dir))
    .filter((f) => /\.(ts|tsx|json|html)$/.test(f))
    .filter((f) => pattern.test(readFileSync(f, 'utf-8')))
    .map((f) => path.relative(REPO_ROOT, f));
}

describe('no protected-content / entitlement surface', () => {
  it('no entitlement source file exists anywhere in the shipped code', () => {
    const found = [
      ...filesNamed('core/src', /entitle/i),
      ...filesNamed('shared', /entitle/i),
      ...filesNamed('platforms', /entitle/i),
    ];
    expect(found).toEqual([]);
  });

  it('no platform source mentions entitlement at all', () => {
    const found = ['webos', 'tizen', 'vizio'].flatMap((p) =>
      sourcesMentioning(`platforms/${p}/src`, /entitle/i)
    );
    expect(found).toEqual([]);
  });

  it('the shared contract barrel exports no entitlement contract', () => {
    const idx = readFileSync(path.join(REPO_ROOT, 'shared/contracts/index.ts'), 'utf-8');
    expect(idx).not.toMatch(/\.\/entitlement/);
  });

  it('the reference service answers no entitlement route', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'core/reference-service/server.ts'), 'utf-8');
    expect(src).not.toMatch(/\/api\/entitlement/i);
  });

  it('no entitlement contract fixtures remain to imply a consumer', () => {
    const found = [
      ...filesNamed('tests/fixtures/contracts', /entitle/i),
      ...filesNamed('tests/contract/fixtures', /entitle/i),
    ];
    expect(found).toEqual([]);
  });

  it('neither locale dictionary offers the viewer an entitlement or paywall string', () => {
    for (const [locale, dict] of [
      ['en', EN],
      ['es', ES],
    ] as const) {
      const keys = Object.keys(dict).filter((k) => /entitle|premium|paywall|locked/i.test(k));
      expect(keys, `${locale} keys`).toEqual([]);
      const values = Object.values(dict).filter((v) =>
        /entitle|premium|paywall|unlock|subscribe/i.test(String(v))
      );
      expect(values, `${locale} strings`).toEqual([]);
    }
  });

  it('the scans above are not vacuous', () => {
    // An empty directory walk would "pass" every absence assertion above, which is the
    // classic way a guard like this goes quietly useless. Count what is actually scanned.
    const scanned = ['webos', 'tizen', 'vizio'].map((p) => walk(`platforms/${p}/src`).length);
    // 20, not a number close to the real one: this guard only has to notice a scan that
    // returned nothing, and a tight bound here becomes a maintenance chore.
    for (const n of scanned) expect(n, 'files scanned under one platform src').toBeGreaterThan(20);
    expect(walk('core/src').length).toBeGreaterThan(20);
    expect(walk('tests/fixtures/contracts').length).toBeGreaterThan(5);
    // And a planted probe proves the pattern really matches when the word is present.
    const withWord = sourcesMentioning('shared/contracts', /analytics/);
    expect(withWord.length).toBeGreaterThan(0);
  });
});
