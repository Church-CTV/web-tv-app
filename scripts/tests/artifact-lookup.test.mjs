/**
 * Artifact lookup contract (WEB-015): finding out whether a shipped artifact exists must not
 * crash when it does not.
 *
 * Why this file exists: proved at 15:49 on 2026-10-27 by running the gate with the three
 * packaged artifacts moved out of `build/` and nothing else changed. The gate guards on
 * `existsSync(buildDir)`, but `build/` survives packaging - it keeps `package-meta.json`,
 * `stage/` and `store-assets/` - so the guard was true, the strict lookup ran anyway, and the
 * run died with:
 *
 *   Error: platforms/webos/build: expected exactly one .ipk, found 0: (none)
 *
 * Exit 1, no report, no defect line. The "shipped comparison skipped" branch the previous
 * wording printed was only ever reachable when `build/` was deleted outright (a fresh clone),
 * which is exactly the state a release job is NOT in. A check that throws on the state it is
 * meant to tolerate is a check that cannot be run on a half-populated tree.
 *
 * The two questions are different and the API now says so: a packager MUST produce exactly one
 * artifact (`requireArtifact` throws on zero and on several), while a probe for something that
 * may legitimately be absent returns null (`findArtifact`, still throwing on several, because
 * ambiguity is a real problem and not an absence).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findArtifact, requireArtifact, requireNamed } from '../lib/artifact-lookup.mjs';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'artifact-lookup-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});
const touch = (name) => writeFileSync(join(dir, name), 'x');

describe('artifact lookup (WEB-015)', () => {
  it('returns null instead of throwing when the tree holds no matching artifact', () => {
    // The exact release-job shape: build/ exists and holds metadata, just no channel file.
    touch('package-meta.json');
    mkdirSync(join(dir, 'stage'), { recursive: true });
    expect(findArtifact(dir, '.ipk')).toBeNull();
  });

  it('returns null when the directory does not exist at all', () => {
    expect(findArtifact(join(dir, 'no-such-build'), '.wgt')).toBeNull();
  });

  it('finds the single artifact and ignores unrelated files', () => {
    touch('package-meta.json');
    touch('chroma-channel-0.1.0.zip');
    expect(findArtifact(dir, '.zip')).toBe(join(dir, 'chroma-channel-0.1.0.zip'));
  });

  it('still treats two candidates as an error, not as a coin flip', () => {
    touch('a.zip');
    touch('b.zip');
    expect(() => findArtifact(dir, '.zip')).toThrow(/2/);
  });

  it('keeps the strict form strict in both directions', () => {
    touch('package-meta.json');
    expect(() => requireArtifact(dir, '.ipk')).toThrow(/expected exactly one \.ipk/);
    touch('one.ipk');
    expect(requireArtifact(dir, '.ipk')).toBe(join(dir, 'one.ipk'));
  });

  it('names the directory in the error, because three platforms share this helper', () => {
    expect(() => requireArtifact(join(dir, 'missing'), '.wgt')).toThrow(dir);
  });

  it('does not match a longer extension that ends the same way', () => {
    touch('notes.zipx');
    expect(findArtifact(dir, '.zip')).toBeNull();
  });
});

describe('requireNamed', () => {
  it('returns the matching generator entry', () => {
    const results = [{ name: 'icon-80.png', path: '/tmp/icon-80.png' }];
    expect(requireNamed(results, 'icon-80.png', 'gen-icons').path).toBe('/tmp/icon-80.png');
  });

  it('names the generator when an entry stops existing', () => {
    // Destructuring the same filter would hand back `undefined`, and the next property read
    // would die as `TypeError: Cannot read properties of undefined (reading 'path')`.
    expect(() =>
      requireNamed([{ name: 'icon-80.png', path: '/tmp/i.png' }], 'splash.png', 'gen-icons')
    ).toThrow(/gen-icons produced no splash.png entry/);
  });
});
