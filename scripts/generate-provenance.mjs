#!/usr/bin/env node
/**
 * J4d — Provenance manifest for release artifacts.
 *
 * Generates a provenance.json that records:
 *   - source metadata (repo, SHA, ref, URL)
 *   - build metadata (workflow run ID, runner, URL)
 *   - toolchain versions (node, npm, package-lock hash)
 *   - artifact entries (path, platform, type, SHA-256 hash, matching SBOM ref)
 *   - optional cross-validation against checksums.txt
 *
 * Follows the SLSA Provenance v1 conceptual model (spec: slsaprovenance/v1).
 *
 * Usage (CLI):
 *   node scripts/generate-provenance.mjs --repo <dir> [--out <path>] [--checksums <file>]
 *
 * Output:
 *   provenance.json (or --out path)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SPEC_VERSION = 'slsaprovenance/v1';
const SCHEMA_VERSION = '1.0.0';

/**
 * Compute the SHA-256 hash of a string buffer.
 * @param {string} content - the text content
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
export function sha256Hex(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Compute the SHA-256 hash of a file.
 * @param {string} filePath - path to the file
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract source metadata from the GitHub Actions environment.
 * @param {Record<string, string>} env - environment variables
 * @param {string} [fallbackSha] - fallback SHA for local runs
 * @returns {object} source metadata object
 */
export function extractSource(env, fallbackSha) {
  const source = {};
  if (env.GITHUB_REPOSITORY) source.repository = env.GITHUB_REPOSITORY;
  source.sourceSha = env.GITHUB_SHA || fallbackSha || 'unknown';
  if (env.GITHUB_REF) source.ref = env.GITHUB_REF;
  if (env.GITHUB_REF && env.GITHUB_REF.startsWith('refs/')) {
    source.refName = env.GITHUB_REF.replace(/^refs\/(tags\/|heads\/)/, '');
  }
  if (env.GITHUB_REPOSITORY_URL) source.sourceUrl = env.GITHUB_REPOSITORY_URL;
  return source;
}

/**
 * Extract build metadata from the GitHub Actions environment.
 * @param {Record<string, string>} env - environment variables
 * @returns {object} build metadata object
 */
export function extractBuild(env) {
  const build = {};
  if (env.GITHUB_RUN_ID) build.runId = env.GITHUB_RUN_ID;
  if (env.GITHUB_RUN_ATTEMPT) build.runAttempt = env.GITHUB_RUN_ATTEMPT;
  if (env.GITHUB_WORKFLOW) build.workflow = env.GITHUB_WORKFLOW;
  if (env.GITHUB_RUN_URL) build.runUrl = env.GITHUB_RUN_URL;
  if (env.RUNNER_NAME) build.runnerName = env.RUNNER_NAME;
  if (env.RUNNER_ARCH) build.runnerArch = env.RUNNER_ARCH;
  if (env.GITHUB_SERVER_URL) build.serverUrl = env.GITHUB_SERVER_URL;
  return build;
}

/**
 * Extract toolchain version information.
 * @param {string} repoRoot - absolute path to repo root
 * @returns {object} toolchain metadata object
 */
export function extractToolchain(repoRoot) {
  const toolchain = {};
  const userAgent = process.env.npm_config_user_agent || '';
  // Format: "node/v20.11.0 npm/v10.2.4 linux x64"
  const nodeMatch = userAgent.match(/node\/v[\d.]+/);
  if (nodeMatch) toolchain.node = nodeMatch[0].replace('node/', '');
  const npmMatch = userAgent.match(/npm\/v[\d.]+/);
  if (npmMatch) toolchain.npm = npmMatch[0].replace('npm/', '');

  const lockPath = path.join(repoRoot, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    toolchain.packageLockSha256 = hashFile(lockPath);
  }
  return toolchain;
}

/**
 * Infer artifact type from file extension.
 * @param {string} filePath - path to the artifact
 * @returns {string} artifact type (ipk, wgt, zip, etc.)
 */
function inferArtifactType(filePath) {
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  return ext || 'unknown';
}

/**
 * Build an artifact entry for the provenance manifest.
 * @param {string} filePath - path to the artifact file
 * @param {string} repoRoot - absolute path to repo root
 * @param {string} platform - platform label
 * @returns {object} artifact entry
 */
export function buildArtifactEntry(filePath, repoRoot, platform) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found: ${filePath}`);
  }
  const relPath = path.relative(repoRoot, filePath);
  return {
    name: path.basename(filePath),
    path: relPath,
    platform,
    type: inferArtifactType(filePath),
    sha256: hashFile(filePath),
  };
}

/**
 * Load SBOM files from a directory and index them by platform.
 * @param {string} sbomsDir - path to sboms directory
 * @returns {object} map of platform → { file, sha256 }
 */
export function loadSboms(sbomsDir) {
  const sboms = {};
  if (!fs.existsSync(sbomsDir)) return sboms;

  const files = fs.readdirSync(sbomsDir).filter((f) => f.endsWith('-cyclonedx.json'));
  for (const file of files) {
    const fullPath = path.join(sbomsDir, file);
    // Infer platform from filename: @ctv_webos-..., @ctv_tizen-..., @ctv_vizio-...
    const match = file.match(/@ctv_(webos|tizen|vizio)-/);
    if (match) {
      const platform = match[1];
      sboms[platform] = {
        file: fullPath,
        sha256: hashFile(fullPath),
      };
    }
  }
  return sboms;
}

/**
 * Validate artifact hashes against a checksums.txt file.
 * @param {string[]} artifacts - array of artifact entries
 * @param {string} checksumsPath - path to checksums.txt
 */
function validateAgainstChecksums(artifacts, checksumsPath) {
  if (!fs.existsSync(checksumsPath)) return;

  const lines = fs
    .readFileSync(checksumsPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim());

  const checksumMap = new Map();
  for (const line of lines) {
    const [hash, filepath] = line.trim().split(/\s+/);
    if (hash && filepath) {
      checksumMap.set(filepath, hash);
    }
  }

  for (const artifact of artifacts) {
    const expected = checksumMap.get(artifact.path);
    if (expected && expected !== artifact.sha256) {
      throw new Error(
        `Checksum mismatch for ${artifact.path}: ` +
          `provenance=${artifact.sha256}, checksums.txt=${expected}`
      );
    }
  }
}

/**
 * Build the complete provenance manifest and write it to disk.
 * @param {string} repoRoot - absolute path to repo root
 * @param {string} outPath - absolute path to output provenance.json
 * @param {object} [options] - optional settings
 * @param {string} [options.checksumsFile] - path to checksums.txt for validation
 * @returns {object} the provenance manifest object
 */
export function buildProvenance(repoRoot, outPath, options = {}) {
  const env = process.env;
  const source = extractSource(env, 'local-run');
  const build = extractBuild(env);
  const toolchain = extractToolchain(repoRoot);

  // Build artifact entries from all three platform build directories
  const platformPatterns = [
    {
      platform: 'webos',
      dir: path.join(repoRoot, 'platforms', 'webos', 'build'),
      extensions: ['.ipk'],
    },
    {
      platform: 'tizen',
      dir: path.join(repoRoot, 'platforms', 'tizen', 'build'),
      extensions: ['.wgt'],
    },
    {
      platform: 'vizio',
      dir: path.join(repoRoot, 'platforms', 'vizio', 'build'),
      extensions: ['.zip'],
    },
  ];

  const artifacts = [];
  for (const pp of platformPatterns) {
    if (!fs.existsSync(pp.dir)) continue;
    const files = fs.readdirSync(pp.dir).filter((f) => {
      return pp.extensions.some((ext) => f.endsWith(ext));
    });
    for (const file of files) {
      const fullPath = path.join(pp.dir, file);
      artifacts.push(buildArtifactEntry(fullPath, repoRoot, pp.platform));
    }
  }

  if (artifacts.length === 0) {
    throw new Error('No artifacts found in any platform build directory');
  }

  // Load SBOMs and attach to matching artifacts
  const sboms = loadSboms(path.join(repoRoot, 'sboms'));
  for (const artifact of artifacts) {
    if (sboms[artifact.platform]) {
      artifact.sbom = sboms[artifact.platform];
    }
  }

  // Cross-validate against checksums.txt if provided
  if (options.checksumsFile) {
    validateAgainstChecksums(artifacts, options.checksumsFile);
  }

  const provenance = {
    spec: SPEC_VERSION,
    version: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source,
    build,
    toolchain,
    artifacts,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(provenance, null, 2) + '\n');
  console.log(`[provenance] Wrote ${artifacts.length} artifact entries to ${outPath}`);
  return provenance;
}

// CLI entry point:
//   node scripts/generate-provenance.mjs --repo <dir> [--out <path>] [--checksums <file>]
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);
  const repoIdx = args.indexOf('--repo');
  const outIdx = args.indexOf('--out');
  const checksumsIdx = args.indexOf('--checksums');

  if (repoIdx === -1 || repoIdx >= args.length - 1) {
    console.error(
      'Usage: generate-provenance.mjs --repo <dir> [--out <path>] [--checksums <file>]'
    );
    process.exit(1);
  }

  const repoRoot = path.resolve(args[repoIdx + 1]);
  const outPath =
    outIdx !== -1 && outIdx < args.length - 1
      ? path.resolve(args[outIdx + 1])
      : path.join(repoRoot, 'provenance.json');
  const checksumsFile =
    checksumsIdx !== -1 && checksumsIdx < args.length - 1
      ? path.resolve(args[checksumsIdx + 1])
      : undefined;

  try {
    buildProvenance(repoRoot, outPath, { checksumsFile });
  } catch (e) {
    console.error(`[provenance] ERROR: ${e.message}`);
    process.exit(1);
  }
}
