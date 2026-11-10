/**
 * F3 — the webOS packager must record HOW it built the .ipk so that CI
 * output is never silently mistaken for a store-submittable ares-package.
 *
 * `platforms/webos/scripts/package.sh` uses `ares-package` when the LG webOS
 * TV SDK is present and falls back to a tar-based packager otherwise (so CI
 * works without the proprietary SDK). LG Seller Lounge expects
 * ares-package output; the tar fallback is CI/diagnostic only.
 *
 * These tests:
 *  - unit-test the pure `buildMeta` / `isStoreReady` helpers
 *    (exported from scripts/package-meta.mjs), and
 *  - wire-test that package.sh actually calls the helper and records the
 *    packager it used, so a future edit cannot drop the distinction.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMeta, isStoreReady } from './package-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8');

describe('F3: buildMeta', () => {
  it('marks ares-package output as store-ready', () => {
    const m = buildMeta('ares', {
      appId: 'com.chroma.webos',
      version: '1.0.0',
      file: 'com.chroma.webos-1.0.0.ipk',
    });
    expect(m.packager).toBe('ares');
    expect(m.storeReady).toBe(true);
    expect(isStoreReady(m)).toBe(true);
    expect(m.platform).toBe('webos');
  });

  it('marks the tar fallback as NOT store-ready', () => {
    const m = buildMeta('tar', {
      appId: 'com.chroma.webos',
      version: '1.0.0',
      file: 'com.chroma.webos-1.0.0.ipk',
    });
    expect(m.packager).toBe('tar');
    expect(m.storeReady).toBe(false);
    expect(isStoreReady(m)).toBe(false);
  });
});

describe('F3: package.sh records the packager in use', () => {
  const src = read('platforms/webos/scripts/package.sh');

  it('writes build/package-meta.json via the shared helper', () => {
    expect(src).toMatch(/package-meta\.mjs/);
    expect(src).toMatch(/package-meta\.json/);
  });

  it('passes the packager it actually used to the helper', () => {
    expect(src).toMatch(/--packager\s+"\$PACKAGER"/);
  });

  it('sets PACKAGER=ares in the ares branch and tar in the fallback', () => {
    expect(src).toMatch(/PACKAGER=ares/);
    expect(src).toMatch(/PACKAGER=tar/);
  });
});
