#!/usr/bin/env node
/**
 * J4b — CycloneDX SBOM generation for release artifacts.
 *
 * Reads `package-lock.json` and generates a CycloneDX 1.5 SBOM for each
 * of the three platform packages (webOS, Tizen, Vizio) using only
 * Node.js built-in modules (fs, path, crypto).
 *
 * Usage (CLI):
 *   node scripts/generate-sbom.mjs [--out <dir>] [--repo <dir>]
 *
 * Output files:
 *   sboms/@ctv_webos-<version>-cyclonedx.json
 *   sboms/@ctv_tizen-<version>-cyclonedx.json
 *   sboms/@ctv_vizio-<version>-cyclonedx.json
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * CycloneDX SBOM platform definitions.
 * Keys are the workspace paths in package-lock.json; values contain
 * the package name, platform label, and file-name-safe identifier.
 */
const PLATFORMS = {
  'platforms/webos': {
    name: '@ctv/webos',
    platformLabel: 'LG webOS',
    filePrefix: '@ctv_webos',
  },
  'platforms/tizen': {
    name: '@ctv/tizen',
    platformLabel: 'Samsung Tizen',
    filePrefix: '@ctv_tizen',
  },
  'platforms/vizio': {
    name: '@ctv/vizio',
    platformLabel: 'Vizio SmartCast',
    filePrefix: '@ctv_vizio',
  },
};

const BOM_SPEC_VERSION = '1.5';
const TOOL_NAME = 'webos-night-shift-sbom';
const TOOL_VERSION = '1.0.0';

/**
 * Parse a package-lock.json file from the repo root.
 * @param {string} repoRoot - absolute path to the repo root
 * @returns {object} the parsed lockfile object
 */
export function parseLockfile(repoRoot) {
  const lockPath = path.join(repoRoot, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    throw new Error(`package-lock.json not found in ${repoRoot}`);
  }
  const raw = fs.readFileSync(lockPath, 'utf-8');
  const lockfile = JSON.parse(raw);

  if (!lockfile.lockfileVersion || !['2', '3'].includes(String(lockfile.lockfileVersion))) {
    throw new Error(`Unsupported lockfileVersion: ${lockfile.lockfileVersion}. Expected 2 or 3.`);
  }

  return lockfile;
}

/**
 * Build CycloneDX components from lockfile packages.
 * Only npm registry packages (those with a `resolved` URL pointing to
 * registry.npmjs.org or similar) are included.
 *
 * @param {object} lockfile - the parsed package-lock.json
 * @returns {object[]} array of CycloneDX component objects
 */
export function buildComponents(lockfile) {
  const components = [];
  const seen = new Set();

  for (const [key, pkg] of Object.entries(lockfile.packages || {})) {
    // Skip the root workspace entry
    if (key === '') continue;

    // Skip workspace / local packages (no resolved npm registry URL)
    if (!pkg.resolved || !pkg.resolved.startsWith('https://registry')) continue;

    const name = pkg.name || key.replace(/^.*node_modules\//, '').replace(/^\//, '');
    const version = pkg.version || 'unknown';

    // Deduplicate by name@version
    const dedupKey = `${name}@${version}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const component = {
      type: 'library',
      name,
      version,
      purl: buildPurl(name, version),
    };

    // Hash from integrity field (usually sha512-<base64>)
    if (pkg.integrity) {
      const parts = pkg.integrity.split(' ');
      // integrity format: "sha512-xxx" or "sha512-xxx sha256-yyy" (take first)
      const integrityEntry = parts[0];
      const dashIdx = integrityEntry.indexOf('-');
      const algo = dashIdx > 0 ? integrityEntry.substring(0, dashIdx) : 'sha512';
      const hashValue = dashIdx > 0 ? integrityEntry.substring(dashIdx + 1) : integrityEntry;

      const cycloneAlg = algo.replace(/^sha/, 'SHA-').toUpperCase().replace('-', '-');
      component.hashes = [
        {
          alg: cycloneAlg,
          content: hashValue,
        },
      ];
    }

    // License
    if (pkg.license) {
      component.licenses = [{ license: { id: pkg.license } }];
    }

    components.push(component);
  }

  // Sort for deterministic output
  components.sort((a, b) => a.name.localeCompare(b.name));

  return components;
}

/**
 * Build a CycloneDX package URL (purl) for an npm package.
 * @param {string} name - package name (may be scoped)
 * @param {string} version - package version
 * @returns {string} purl string
 */
export function buildPurl(name, version) {
  // URL-encode the name: scoped packages need @ → %40 and / → %2F
  const encodedName = name.replace(/@/g, '%40').replace(/\//g, '%2F');
  return `pkg:npm/${encodedName}@${version}`;
}

/**
 * Build a CycloneDX SBOM object.
 * @param {object} lockfile - the parsed package-lock.json
 * @param {object} platformInfo - platform-specific metadata
 * @param {object} platformInfo.bomRef - unique bomRef
 * @param {object} platformInfo.name - package name
 * @param {object} platformInfo.version - package version
 * @param {object} [platformInfo.description] - optional description
 * @returns {object} CycloneDX SBOM object
 */
export function buildBom(lockfile, platformInfo) {
  const components = buildComponents(lockfile);

  const component = {
    type: 'application',
    bomRef: platformInfo.bomRef,
    name: platformInfo.name,
    version: platformInfo.version,
  };

  if (platformInfo.description) {
    component.description = platformInfo.description;
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: BOM_SPEC_VERSION,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'unconfigured',
          name: TOOL_NAME,
          version: TOOL_VERSION,
        },
      ],
      component,
    },
    components,
  };
}

/**
 * Generate SBOM files for all three platforms.
 * @param {string} repoRoot - absolute path to the repo root
 * @param {string} outDir - absolute path to the output directory
 * @returns {object[]} array of results: [{ platform, filePath, name, version, componentCount }]
 */
export function generateSboms(repoRoot, outDir) {
  const lockfile = parseLockfile(repoRoot);
  const components = buildComponents(lockfile);
  const results = [];

  for (const [workspacePath, platform] of Object.entries(PLATFORMS)) {
    const workspacePkg = lockfile.packages[workspacePath];
    if (!workspacePkg) {
      throw new Error(`Workspace ${workspacePath} not found in lockfile`);
    }

    const version = workspacePkg.version || '0.0.0';
    const fileName = `${platform.filePrefix}-${version}-cyclonedx.json`;
    const filePath = path.join(outDir, fileName);

    const bom = buildBom(lockfile, {
      bomRef: crypto.randomUUID(),
      name: platform.name,
      version,
      description: `CycloneDX SBOM for ${platform.name} (${platform.platformLabel})`,
    });

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(bom, null, 2) + '\n');

    console.log(
      `[sbom] ${platform.name} v${version}: ${components.length} components → ${fileName}`
    );

    results.push({
      platform,
      filePath,
      name: platform.name,
      version,
      componentCount: components.length,
    });
  }

  return results;
}

// CLI entry point:
//   node scripts/generate-sbom.mjs [--out <dir>] [--repo <dir>]
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const repoIdx = args.indexOf('--repo');

  const outDir =
    outIdx !== -1 && outIdx < args.length - 1
      ? path.resolve(args[outIdx + 1])
      : path.join(process.cwd(), 'sboms');
  const repoRoot =
    repoIdx !== -1 && repoIdx < args.length - 1 ? path.resolve(args[repoIdx + 1]) : process.cwd();

  try {
    const results = generateSboms(repoRoot, outDir);
    console.log(`[sbom] Generated ${results.length} SBOMs in ${outDir}`);
  } catch (e) {
    console.error(`[sbom] ERROR: ${e.message}`);
    process.exit(1);
  }
}
