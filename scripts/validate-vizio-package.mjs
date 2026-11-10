#!/usr/bin/env node
/**
 * WEB-014: Comprehensive Vizio SmartCast package validation.
 *
 * Validates that a Vizio SmartCast package is store-submittable:
 * - Requires a valid manifest.json with all mandatory fields
 * - Validates version format (semver)
 * - Validates required icon sizes
 * - Validates entry point exists
 * - Validates app name length and characters
 * - Validates minimum version format
 * - Rejects packages with unexpected files
 *
 * Usage: node scripts/validate-vizio-package.mjs <path/to/package-dir>
 * Exit 0 if valid, exit 1 with error message otherwise.
 */
import { readFileSync, existsSync, statSync, readdirSync, lstatSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const pkgDir = process.argv[2];

if (!pkgDir) {
  console.error('Usage: node scripts/validate-vizio-package.mjs <package-dir>');
  process.exit(1);
}

if (!existsSync(pkgDir)) {
  console.error(`Package directory not found: ${pkgDir}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

// Validate manifest.json
const manifestPath = join(pkgDir, 'manifest.json');
if (!existsSync(manifestPath)) {
  errors.push('Missing manifest.json');
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    errors.push(`manifest.json is not valid JSON: ${e.message}`);
    manifest = null;
  }

  if (manifest) {
    // Validate name
    if (!manifest.name) {
      errors.push('Manifest missing required field: name');
    } else {
      if (typeof manifest.name !== 'string') {
        errors.push('Manifest name must be a string');
      } else {
        if (manifest.name.length < 2) {
          errors.push(`Manifest name too short (min 2 chars): "${manifest.name}"`);
        }
        if (manifest.name.length > 128) {
          errors.push(`Manifest name too long (max 128 chars): ${manifest.name.length} chars`);
        }
        // Check for special characters that are problematic in package names
        if (/[<>:"/\\|?*]/.test(manifest.name)) {
          errors.push(`Manifest name contains invalid characters: "${manifest.name}"`);
        }
      }
    }

    // Validate version (semver)
    if (!manifest.version) {
      errors.push('Manifest missing required field: version');
    } else {
      if (typeof manifest.version !== 'string') {
        errors.push('Manifest version must be a string');
      } else {
        // Accept semver major.minor.patch with optional prerelease
        const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
        if (!semverRegex.test(manifest.version)) {
          errors.push(`Manifest version is not valid semver: "${manifest.version}"`);
        }
      }
    }

    // Validate main entry point
    if (!manifest.main) {
      errors.push('Manifest missing required field: main');
    } else {
      if (typeof manifest.main !== 'string') {
        errors.push('Manifest main must be a string');
      } else {
        const mainPath = join(pkgDir, manifest.main);
        if (!existsSync(mainPath)) {
          errors.push(`Manifest main entry point does not exist: ${manifest.main}`);
        }
        if (!manifest.main.endsWith('.html')) {
          warnings.push(`Manifest main should typically be an HTML file: ${manifest.main}`);
        }
      }
    }

    // Validate icons
    if (!manifest.icons) {
      errors.push('Manifest missing required field: icons');
    } else {
      if (typeof manifest.icons !== 'object' || Array.isArray(manifest.icons)) {
        errors.push('Manifest icons must be an object mapping sizes to paths');
      } else {
        const iconSizes = Object.keys(manifest.icons);
        if (iconSizes.length === 0) {
          errors.push('Manifest icons object is empty');
        } else {
          // Check icon paths exist
          for (const size of iconSizes) {
            const iconPath = join(pkgDir, manifest.icons[size]);
            if (!existsSync(iconPath)) {
              errors.push(`Icon file does not exist for size ${size}: ${manifest.icons[size]}`);
            }
          }

          // Vizio requires at least the 120x120 icon
          if (!manifest.icons['120']) {
            errors.push('Manifest missing required 120x120 icon');
          }
        }
      }
    }

    // Validate orientation (should be landscape for CTV)
    if (manifest.orientation && manifest.orientation !== 'landscape') {
      warnings.push(`Orientation "${manifest.orientation}" is unusual for a CTV app; consider "landscape"`);
    }

    // Validate minimum_version if present
    if (manifest.minimum_version) {
      if (typeof manifest.minimum_version !== 'string') {
        errors.push('Manifest minimum_version must be a string');
      } else {
        const minVersionRegex = /^\d+\.\d+(\.\d+)?$/;
        if (!minVersionRegex.test(manifest.minimum_version)) {
          errors.push(`Manifest minimum_version is not valid: "${manifest.minimum_version}" (expected X.Y or X.Y.Z)`);
        }
      }
    }

    // Validate background_color if present
    if (manifest.background_color) {
      if (typeof manifest.background_color !== 'string') {
        errors.push('Manifest background_color must be a string');
      } else if (!/^#[0-9A-Fa-f]{6}$/.test(manifest.background_color)) {
        warnings.push(`Manifest background_color format looks unusual: "${manifest.background_color}"`);
      }
    }
  }
}

// Check for unexpected files in the package directory
const unexpectedPatterns = [
  'test-results', 'coverage', '.git', 'node_modules', '.DS_Store',
  'package-lock.json', 'yarn.lock', 'tsconfig.json', '.eslintrc',
  '.prettierrc', 'README.md', 'LICENSE', 'CHANGELOG.md',
  'vitest.config', 'vite.config', 'tsconfig.tsbuildinfo',
  '.env', '.env.', 'coverage'
];

function checkUnexpectedFiles(dir, prefix = '') {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = join(prefix, entry.name);

    if (entry.isDirectory()) {
      checkUnexpectedFiles(fullPath, relPath);
    } else {
      for (const pattern of unexpectedPatterns) {
        if (relPath.includes(pattern)) {
          errors.push(`Unexpected file in package: ${relPath} (matches pattern: ${pattern})`);
          break;
        }
      }
    }
  }
}

checkUnexpectedFiles(pkgDir);

// Check total package size
try {
  let totalSize = 0;
  function sumDirSize(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        sumDirSize(fullPath);
      } else {
        try {
          totalSize += statSync(fullPath).size;
        } catch {
          // ignore
        }
      }
    }
  }
  sumDirSize(pkgDir);
  const sizeMB = totalSize / (1024 * 1024);
  if (sizeMB > 150) {
    errors.push(`Package is too large: ${sizeMB.toFixed(2)} MB (max ~150 MB)`);
  } else if (sizeMB > 100) {
    warnings.push(`Package is quite large: ${sizeMB.toFixed(2)} MB`);
  }
} catch (e) {
  // size calculation failed
}

// Output results
if (errors.length > 0) {
  console.error('Vizio package validation failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
}

if (warnings.length > 0) {
  console.log('Vizio package validation warnings:');
  for (const warn of warnings) {
    console.log(`  - ${warn}`);
  }
}

if (errors.length > 0) {
  process.exit(1);
}

console.log('Vizio package validation passed');
process.exit(0);
