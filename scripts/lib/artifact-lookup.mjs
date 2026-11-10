/**
 * Finding an artifact in a build directory, in the two flavours callers actually need.
 *
 * Why this is not one function: `build/` outlives packaging - it keeps `package-meta.json`,
 * `stage/` and `store-assets/` - so "the directory exists" says nothing about whether a channel
 * archive is in it. The gate used one strict lookup for both jobs, and a reproducibility run
 * against a tree that had been packaged once and then cleared died with
 * `expected exactly one .ipk, found 0` (exit 1, no report) instead of reporting the shipped
 * comparison as skipped. A packager's output is required; a shipped artifact is only sought.
 *
 * Both flavours reject two candidates: that is ambiguity, not absence, and silently picking the
 * first would compare an artifact nobody chose.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function candidates(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(ext))
    .sort();
}

/** The artifact a packager must have produced. Zero or two are both reported as errors. */
export function requireArtifact(dir, ext) {
  const found = candidates(dir, ext);
  if (found.length !== 1) {
    throw new Error(
      `${dir}: expected exactly one ${ext}, found ${found.length}: ${found.join(', ') || '(none)'}`
    );
  }
  return join(dir, found[0]);
}

/** The artifact already sitting in build/, if any. null is a normal answer. */
export function findArtifact(dir, ext) {
  const found = candidates(dir, ext);
  if (found.length === 0) return null;
  if (found.length > 1) {
    throw new Error(
      `${dir}: expected at most one ${ext}, found ${found.length}: ${found.join(', ')}`
    );
  }
  return join(dir, found[0]);
}

/**
 * Pick one entry out of a generator's result list, failing closed when it is missing.
 *
 * Destructuring the filter result - `const [x] = list.filter(...)` - hands back `undefined`
 * when nothing matched, and the next property read dies as `TypeError: Cannot read properties
 * of undefined`. The named error says what stopped producing its artifact, which is the only
 * thing a caller needs after a generator changes shape.
 */
export function requireNamed(results, name, what) {
  const [found] = results.filter((r) => r.name === name);
  if (!found) {
    throw new Error(
      `${what} produced no ${name} entry: the generator must still emit it, or the caller ` +
        'has nothing to read'
    );
  }
  return found;
}
