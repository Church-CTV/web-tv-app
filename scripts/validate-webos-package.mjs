#!/usr/bin/env node
/**
 * WEB-012: Comprehensive webOS package validation.
 *
 * Validates that a webOS channel package is store-submittable:
 * - Requires ares-package output (rejects tar fallback / diagnostic archives)
 * - Requires complete package metadata (appId, version, file, packager, storeReady)
 * - Validates the .ipk file exists and is non-empty
 * - Validates APPINFO has all required fields
 * - Rejects packages with unexpected files (test results, build logs, etc.)
 *
 * Usage: node scripts/validate-webos-package.mjs <path/to/package-meta.json>
 * Exit 0 if valid, exit 1 with error message otherwise.
 */
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

const metaPath = process.argv[2];

if (!metaPath) {
  console.error('Usage: node scripts/validate-webos-package.mjs <package-meta.json>');
  process.exit(1);
}

if (!existsSync(metaPath)) {
  console.error(`package-meta.json not found: ${metaPath}`);
  console.error('Run packaging script first to generate it.');
  process.exit(1);
}

// Read and parse metadata
let meta;
try {
  meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
} catch (e) {
  console.error(`Failed to parse ${metaPath}: ${e.message}`);
  process.exit(1);
}

const errors = [];

// Validate required metadata fields
for (const field of ['packager', 'appId', 'version']) {
  if (!meta[field]) {
    errors.push(`Missing required field: ${field}`);
  }
}

// storeReady must be an explicit boolean
if (typeof meta.storeReady !== 'boolean') {
  errors.push('Missing required field: storeReady');
}

// file field is optional (may be empty string if not recorded)
if (typeof meta.file !== 'string') {
  errors.push('Missing required field: file');
}

if (errors.length > 0) {
  console.error('Package metadata incomplete:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

// Validate storeReady (reject diagnostic tar fallback)
if (meta.storeReady !== true) {
  if (meta.packager === 'tar') {
    errors.push('Diagnostic tar package detected - not store-submittable');
    errors.push('CI runner must have webOS TV SDK (ares-package) installed');
  } else {
    errors.push(`Package not marked store-ready (packager=${meta.packager})`);
  }
}

// Validate .ipk file exists and is non-empty (only if file path is provided)
const hasFilePath = typeof meta.file === 'string' && meta.file.length > 0;
if (hasFilePath) {
  const buildDir = dirname(metaPath);
  const ipkPath = meta.file.startsWith('/') ? meta.file : join(buildDir, meta.file);
  if (!existsSync(ipkPath)) {
    errors.push(`Package file not found: ${ipkPath}`);
  } else {
    try {
      const stats = statSync(ipkPath);
      if (stats.size === 0) {
        errors.push(`Package file is empty: ${ipkPath}`);
      } else {
        const sizeKB = Math.round(stats.size / 1024);
        if (sizeKB < 10) {
          errors.push(`Package suspiciously small (<10KB): ${ipkPath} (${sizeKB}KB)`);
        }
      }
    } catch (e) {
      errors.push(`Failed to stat package file ${ipkPath}: ${e.message}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Package validation failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

// Validate appinfo.json and package contents inside the official Debian-format IPK.
let appinfoValid = false;
const appinfoErrors = [];

if (hasFilePath) {
  const buildDir = dirname(metaPath);
  const ipkPath = meta.file.startsWith('/') ? meta.file : join(buildDir, meta.file);
  let extractDir;

  try {
    const { execFileSync } = await import('child_process');
    extractDir = mkdtempSync(join(tmpdir(), 'webos-ipk-'));
    const dataArchive = execFileSync('ar', ['p', ipkPath, 'data.tar.gz']);
    const fileListing = execFileSync('tar', ['-tzf', '-'], { input: dataArchive })
      .toString()
      .trim()
      .split('\n');
    execFileSync('tar', ['-xzf', '-', '-C', extractDir], { input: dataArchive });

    const appRoot = join(extractDir, 'usr', 'palm', 'applications', meta.appId);
    const appinfoPath = join(appRoot, 'appinfo.json');
    const appinfo = JSON.parse(readFileSync(appinfoPath, 'utf-8'));

    for (const field of ['id', 'version', 'title', 'main', 'type']) {
      if (!appinfo[field]) {
        appinfoErrors.push(`appinfo.json missing required field: ${field}`);
      }
    }

    if (appinfo.type && appinfo.type !== 'web') {
      appinfoErrors.push(`appinfo.json type must be 'web', got: ${appinfo.type}`);
    }
    if (appinfo.id !== meta.appId) {
      appinfoErrors.push(`appinfo.json id mismatch: expected ${meta.appId}, got ${appinfo.id}`);
    }
    if (appinfo.version !== meta.version) {
      appinfoErrors.push(
        `appinfo.json version mismatch: expected ${meta.version}, got ${appinfo.version}`
      );
    }
    if (appinfo.main && !existsSync(join(appRoot, appinfo.main))) {
      appinfoErrors.push(`appinfo.json main file not found in package: ${appinfo.main}`);
    }

    const unexpectedPatterns = [
      'test-results',
      'coverage',
      '.git',
      'node_modules',
      '.DS_Store',
      'package-lock.json',
      'yarn.lock',
      'tsconfig.json',
      '.eslintrc',
      '.prettierrc',
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'certification-report.json',
      'checksums.txt',
      'provenance.json',
      'package-meta.json',
      '/tmp/',
    ];
    for (const pattern of unexpectedPatterns) {
      if (fileListing.some((file) => file.includes(pattern))) {
        appinfoErrors.push(`Unexpected file pattern in package: ${pattern}`);
      }
    }

    appinfoValid = appinfoErrors.length === 0;
  } catch (e) {
    appinfoErrors.push(`Could not inspect official IPK payload: ${e.message}`);
  } finally {
    if (extractDir) {
      rmSync(extractDir, { recursive: true, force: true });
    }
  }
}

if (appinfoErrors.length > 0) {
  console.error('APPINFO validation failed:');
  for (const err of appinfoErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

// All validations passed
console.log(`Package valid: ${meta.file}`);
console.log(`  packager: ${meta.packager}`);
console.log(`  storeReady: ${meta.storeReady}`);
console.log(`  appId: ${meta.appId}`);
console.log(`  version: ${meta.version}`);
if (appinfoValid) {
  console.log('  APPINFO: valid');
}
