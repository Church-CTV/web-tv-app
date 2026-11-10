#!/usr/bin/env node
/**
 * J4a — SHA-256 checksums for release artifacts.
 *
 * Called from the `packaging` job in `.github/workflows/ci.yml` and from
 * `release.yaml`. Produces a `checksums.txt` in the canonical
 * `sha256sum`-compatible format using RELATIVE paths so it can be
 * verified from the repo root:
 *
 *   <64-char-lowercase-hex-hash>  <relative/path>
 *
 * Verify with:
 *   sha256sum -c checksums.txt
 *
 * Usage (CLI):
 *   node scripts/generate-checksums.mjs <file1> [file2...] --out <path> [--base-dir <dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Compute the SHA-256 hash of a file.
 * @param {string} filePath - absolute path to the file
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
export function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Resolve a file path to a relative path string for use in checksums.txt.
 * @param {string} filePath - the file path
 * @param {string} [baseDir] - if provided, resolve relative to this dir
 * @returns {string} the path to store in checksums.txt
 */
export function resolveRelPath(filePath, baseDir) {
  const abs = path.resolve(filePath);
  if (!baseDir) return path.basename(abs);
  const rel = path.relative(path.resolve(baseDir), abs);
  // If outside baseDir, fall back to basename
  if (rel.startsWith('..')) return path.basename(abs);
  return rel;
}

/**
 * Generate checksum lines for a list of files, skipping any that don't exist.
 * @param {string[]} filePaths - file paths
 * @param {string} [baseDir] - base directory for relative paths (optional)
 * @returns {string[]} lines in "hash  relpath" format
 */
export function generateChecksums(filePaths, baseDir) {
  const lines = [];
  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) {
      console.warn(`[checksums] SKIP (not found): ${fp}`);
      continue;
    }
    const hash = hashFile(fp);
    const relPath = resolveRelPath(fp, baseDir);
    lines.push(`${hash}  ${relPath}`);
  }
  return lines;
}

/**
 * Write checksums to the output file.
 * Creates parent directories as needed.
 * @param {string[]} filePaths - file paths
 * @param {string} outputPath - where to write checksums.txt
 * @param {string} [baseDir] - base directory for relative paths (optional)
 * @returns {string[]} the lines written
 */
export function writeChecksums(filePaths, outputPath, baseDir) {
  const lines = generateChecksums(filePaths, baseDir);
  if (lines.length === 0) {
    throw new Error('No files found — nothing to checksum.');
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join('\n') + '\n');
  console.log(`[checksums] Wrote ${lines.length} entries to ${outputPath}`);
  return lines;
}

// CLI entry point:
//   node scripts/generate-checksums.mjs <file1> [file2...] --out <path> [--base-dir <dir>]
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const baseIdx = args.indexOf('--base-dir');

  if (outIdx === -1 || outIdx >= args.length - 1) {
    console.error(
      'Usage: generate-checksums.mjs <file1> [file2...] --out <path> [--base-dir <dir>]'
    );
    process.exit(1);
  }

  const baseDir = baseIdx !== -1 && baseIdx < args.length - 1 ? args[baseIdx + 1] : undefined;
  const files = args.filter((_, i) => {
    if (i === outIdx || i === outIdx + 1) return false;
    if (baseIdx !== -1 && (i === baseIdx || i === baseIdx + 1)) return false;
    return true;
  });

  try {
    writeChecksums(files, args[outIdx + 1], baseDir);
  } catch (e) {
    console.error(`[checksums] ERROR: ${e.message}`);
    process.exit(1);
  }
}
