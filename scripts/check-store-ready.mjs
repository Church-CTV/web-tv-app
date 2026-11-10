#!/usr/bin/env node
/**
 * WEB-011: Validate that a package-meta.json declares storeReady=true.
 * Used by release workflows to reject diagnostic/tar-fallback builds.
 *
 * Usage: node scripts/check-store-ready.mjs <path/to/package-meta.json>
 * Exit 0 if storeReady=true, exit 1 otherwise with error message.
 */
import { readFileSync, existsSync } from 'fs';

const metaPath = process.argv[2];

if (!metaPath) {
  console.error('Usage: node scripts/check-store-ready.mjs <package-meta.json>');
  process.exit(1);
}

if (!existsSync(metaPath)) {
  console.error(`package-meta.json not found: ${metaPath}`);
  console.error('Run packaging script first to generate it.');
  process.exit(1);
}

try {
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  if (!meta.packager) {
    console.error('package-meta.json missing "packager" field');
    process.exit(1);
  }

  if (meta.storeReady !== true) {
    console.error(`Package not store-ready (packager=${meta.packager}): ${metaPath}`);
    if (meta.packager === 'tar') {
      console.error('The tar packager is diagnostic/CI-only. Use ares-package for webOS store submission.');
    }
    process.exit(1);
  }

  console.log(`Package store-ready (packager=${meta.packager}): ${meta.path || 'OK'}`);
} catch (e) {
  console.error(`Failed to parse ${metaPath}: ${e.message}`);
  process.exit(1);
}