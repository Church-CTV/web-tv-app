/**
 * Stage-normalisation contract (WEB-015): a "deterministic stage" has to be deterministic on
 * every host, not only on the one that happens to have a friendly umask.
 *
 * Why this file exists: the staging script pinned mtimes and nothing else, and an experiment on
 * 2026-10-27 showed what that costs. One file's mode changed from `664` to `600` in the Vizio
 * stage - the difference between umask 0002 and a stricter umask, nothing more interesting -
 * and the whole `.zip` hash moved:
 *
 *   mode 664 -> 99646ee2508b2a73ea3f7bd46a5256a5c237f680f6d86af72c024856b76b42b1
 *   mode 600 -> ddda270fa0a23aa8ca3b9e47f3d012400213fd34df1fee8440504b2fc501877b
 *   back to 664 -> 99646ee2508b2a73...  (byte-exact again)
 *
 * `zip -X` keeps the permission bits in the archive's external attributes, so file modes are
 * published bytes, not local detail. Two clones of one commit, packaged on two hosts with two
 * umasks, therefore produced two different artifacts even with identical content and identical
 * pinned timestamps. Modes are now normalised alongside mtimes, with the one piece of intent that
 * has to survive: the executable bit. No packaged file uses it today, which is exactly why the
 * rule is written so that a future one does not silently lose it.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'scripts', 'deterministic-stage.sh');

let stage;
beforeEach(() => {
  stage = mkdtempSync(join(ROOT, '.stage-test-'));
  mkdirSync(join(stage, 'assets'), { recursive: true });
  mkdirSync(join(stage, 'bin'), { recursive: true });
  writeFileSync(join(stage, 'index.html'), 'x');
  writeFileSync(join(stage, 'assets', 'icon.png'), 'y');
  writeFileSync(join(stage, 'bin', 'run.sh'), 'z');
  // A tree as two different hosts would leave it: group-writable here, private there, and one
  // directory nobody outside the owner can enter.
  chmodSync(join(stage, 'index.html'), 0o664);
  chmodSync(join(stage, 'assets', 'icon.png'), 0o600);
  chmodSync(join(stage, 'bin', 'run.sh'), 0o775);
  chmodSync(join(stage, 'assets'), 0o700);
});
afterEach(() => {
  rmSync(stage, { recursive: true, force: true });
});
const readMode = (rel) => statSync(join(stage, rel)).mode & 0o777;
const run = (env = {}) =>
  execFileSync('bash', [SCRIPT, stage], { stdio: 'pipe', env: { ...process.env, ...env } });

describe('deterministic staging (WEB-015)', () => {
  it('normalises file modes so the archive bytes stop depending on the host umask', () => {
    run();
    expect(readMode('index.html')).toBe(0o644);
    expect(readMode('assets/icon.png')).toBe(0o644);
  });

  it('keeps the executable bit, because mode normalisation must not strip intent', () => {
    run();
    expect(readMode('bin/run.sh')).toBe(0o755);
  });

  it('makes directories traversable, so a private source umask cannot bake 0700 into a tree', () => {
    run();
    expect(readMode('assets')).toBe(0o755);
  });

  it('still pins every mtime, and honours SOURCE_DATE_EPOCH for both', () => {
    // A value that is NOT the script's default, on purpose: handing 315532800 back in would prove
    // nothing about the override path. The expectation comes from the value passed to the script,
    // never from this test process's own environment, which run() merges into the child anyway.
    const epoch = 946684800; // 2000-01-01T00:00:00Z
    run({ SOURCE_DATE_EPOCH: String(epoch) });
    for (const rel of ['index.html', 'assets', 'assets/icon.png', 'bin/run.sh']) {
      expect(Math.floor(statSync(join(stage, rel)).mtimeMs / 1000)).toBe(epoch);
    }
  });

  it('falls back to the documented default epoch when SOURCE_DATE_EPOCH is absent', () => {
    // run() merges process.env, so the variable has to be deleted rather than simply not passed:
    // an ambient value in a CI shell would otherwise decide this assertion's answer.
    const env = { ...process.env };
    delete env.SOURCE_DATE_EPOCH;
    execFileSync('bash', [SCRIPT, stage], { stdio: 'pipe', env });
    for (const rel of ['index.html', 'assets', 'assets/icon.png', 'bin/run.sh']) {
      expect(Math.floor(statSync(join(stage, rel)).mtimeMs / 1000)).toBe(315532800);
    }
  });

  it('is idempotent: running it twice cannot change a normalised tree', () => {
    run();
    const before = ['index.html', 'assets', 'assets/icon.png', 'bin/run.sh'].map(readMode);
    run();
    expect(['index.html', 'assets', 'assets/icon.png', 'bin/run.sh'].map(readMode)).toEqual(before);
  });

  it('refuses a stage that does not exist instead of normalising the filesystem', () => {
    expect(() => execFileSync('bash', [SCRIPT, join(stage, 'nope')], { stdio: 'pipe' })).toThrow(
      /no staging tree/
    );
  });
});
