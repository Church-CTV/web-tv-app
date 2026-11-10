/**
 * Cross-device file move (WEB-015 follow-up): the reproducibility gate relocates packaged
 * artifacts between `build/` and a scratch directory, and a bare `renameSync` only works when
 * both sides share a filesystem.
 *
 * Why this file exists: the release rehearsal run 40566120178 (2026-10-27, head 479b700) died
 * with `EXDEV: cross-device link not permitted` moving `platforms/webos/build/*.ipk` into a
 * scratch directory under `/tmp`. The runner workspace sits on `/opt/github-runners` (ext4)
 * while `/tmp` is tmpfs. Locally the same code passes because Hermes exports TMPDIR pointing at
 * a scratch directory on the repo's own filesystem, so a same-device assumption survived every
 * local run and failed on first contact with CI. A gate that crashes is worse than a gate that
 * fails: it stops the release job without reporting anything about reproducibility.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { moveFile, restoreArtifact } from './fs-move.mjs';

let dir;
let counter = 0;

/** A fresh source file with known bytes, so every case starts from the same state. */
function source(content = 'chroma-artifact-bytes') {
  const file = join(dir, `src-${counter++}.bin`);
  writeFileSync(file, content);
  return { file, content };
}

function missing(src) {
  try {
    readFileSync(src);
    return false;
  } catch {
    return true;
  }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'fs-move-test-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('moveFile', () => {
  it('renames when the two paths share a filesystem', () => {
    const { file, content } = source();
    const dest = join(dir, 'dest-rename.bin');

    expect(moveFile(file, dest)).toBe('renamed');
    expect(readFileSync(dest, 'utf8')).toBe(content);
    expect(missing(file)).toBe(true);
  });

  it('falls back to copy plus remove when rename reports EXDEV', () => {
    const { file, content } = source();
    const dest = join(dir, 'dest-exdev.bin');
    const attempts = [];

    const result = moveFile(file, dest, {
      rename: (from, to) => {
        attempts.push([from, to]);
        const error = new Error(`EXDEV: cross-device link not permitted, rename '${from}'`);
        error.code = 'EXDEV';
        throw error;
      },
    });

    // The whole point: a cross-device rename is an expected environment, not a failure, and
    // the artifact must still arrive complete with the source cleared.
    expect(result).toBe('copied');
    expect(attempts).toEqual([[file, dest]]);
    expect(readFileSync(dest, 'utf8')).toBe(content);
    expect(missing(file)).toBe(true);
  });

  it('rethrows a rename failure that is not cross-device', () => {
    const { file } = source();
    const dest = join(dir, 'dest-eacces.bin');

    expect(() =>
      moveFile(file, dest, {
        rename: () => {
          const error = new Error('EACCES: permission denied, rename');
          error.code = 'EACCES';
          throw error;
        },
      })
    ).toThrow(/EACCES/);

    // A real permission problem must stay visible and must not be papered over by a copy that
    // would leave the caller holding two half-truths.
    expect(missing(dest)).toBe(true);
    expect(missing(file)).toBe(false);
  });
});

/**
 * Restore after a failed pass (WEB-015 adversarial review, MEDIUM).
 *
 * `pack()` runs a packager that removes `build/*.<ext>` and rewrites it at the same path. When the
 * pass then throws, that path holds the packager's output, so a cleanup that restores only an empty
 * `build/` keeps the wrong file and deletes the backup with the scratch directory. The developer's
 * signed artifact is gone with no copy left anywhere.
 */
describe('restoreArtifact', () => {
  function paths(prefix) {
    const build = join(dir, `${prefix}-build`);
    mkdirSync(build, { recursive: true });
    return { shipped: join(build, 'app.ipk'), shippedCopy: join(dir, `${prefix}-copy.ipk`) };
  }

  it('replaces what a failed pass left at the shipped path with the original bytes', () => {
    const { shipped, shippedCopy } = paths('restore-overwrite');
    writeFileSync(shipped, 'packager-partial-output'); // a throw left the packager's own file here
    writeFileSync(shippedCopy, 'signed-original-bytes');

    expect(restoreArtifact({ shipped, shippedCopy })).toBe(true);
    expect(readFileSync(shipped, 'utf8')).toBe('signed-original-bytes');
    expect(missing(shippedCopy)).toBe(true); // moved, so scratch cleanup cannot strand it
  });

  it('restores into a build directory the packager emptied', () => {
    const { shipped, shippedCopy } = paths('restore-empty');
    writeFileSync(shippedCopy, 'signed-original-bytes');

    expect(restoreArtifact({ shipped, shippedCopy })).toBe(true);
    expect(readFileSync(shipped, 'utf8')).toBe('signed-original-bytes');
  });

  it('does nothing when there was never a shipped artifact to protect', () => {
    const { shipped, shippedCopy } = paths('restore-none');
    writeFileSync(shipped, 'first-package-output'); // packaging a fresh tree, nothing was shipped

    expect(restoreArtifact({ shipped, shippedCopy })).toBe(false);
    expect(readFileSync(shipped, 'utf8')).toBe('first-package-output');
    expect(restoreArtifact({ shipped: null, shippedCopy: null })).toBe(false);
    expect(restoreArtifact({ shipped, shippedCopy: join(dir, 'restore-missing-copy.ipk') })).toBe(
      false
    );
  });
});
