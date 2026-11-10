/**
 * File relocation that survives a filesystem boundary.
 *
 * `renameSync` is atomic and cheap, but it only works inside one filesystem. The
 * reproducibility gate (WEB-015) moves packaged artifacts between a `platforms` build
 * directory and a scratch directory, and on a CI runner those can be different filesystems: the runner
 * workspace is on the disk volume while `/tmp` is tmpfs. Release rehearsal run 40566120178
 * died with `EXDEV` for exactly that reason, which stopped the release job without reporting
 * anything about reproducibility. This helper keeps the atomic path when it is available and
 * degrades to copy plus remove when the rename reports a cross-device link, while still
 * throwing for every other rename failure so a real problem stays visible.
 */
import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';

/**
 * Move `src` to `dest`.
 *
 * @param {string} src source file
 * @param {string} dest destination path; its parent directory must exist
 * @param {{rename?: Function, copy?: Function, remove?: Function}} [deps] injectable for tests
 * @returns {'renamed'|'copied'} which path was taken, so a caller can report or assert it
 */
export function moveFile(src, dest, deps = {}) {
  const rename = deps.rename ?? renameSync;
  const copy = deps.copy ?? copyFileSync;
  const remove = deps.remove ?? rmSync;

  try {
    rename(src, dest);
    return 'renamed';
  } catch (error) {
    if (!error || error.code !== 'EXDEV') throw error;
    // Cross-device is an expected environment, not a defect: relocate the bytes instead.
    copy(src, dest);
    remove(src);
    return 'copied';
  }
}

/**
 * Put a backed-up artifact back in `build/`, whatever a failed step left sitting there.
 *
 * Why this exists: the reproducibility gate copies a shipped artifact into scratch before it
 * re-packages, and its cleanup moved the backup back only when `build/` had become empty. The
 * packager removes the artifact and rewrites it at the same path, so a throw after that point
 * leaves the packager's own output there, the old condition read "something is present", and the
 * original was deleted with the scratch directory. After a failed pass, whatever sits at the
 * shipped path is not the artifact the developer put there, which is why the restore here is
 * unconditional on the copy rather than conditional on the destination being empty.
 *
 * @param {{shipped: string|null, shippedCopy: string|null, move?: Function, exists?: Function}} args
 *   `shipped` is the path the artifact came from, `shippedCopy` the backup taken before re-packaging
 * @returns {boolean} whether a backup was restored, so a caller or a test can see the decision
 */
export function restoreArtifact({ shipped, shippedCopy, move = moveFile, exists = existsSync }) {
  if (!shipped || !shippedCopy || !exists(shippedCopy)) return false;
  move(shippedCopy, shipped);
  return true;
}
