#!/usr/bin/env node
/** WGT integrity verifier. Metadata JSON provides structure evidence only. */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/validate-tizen-signature.mjs <package.wgt|metadata.json>');
  process.exit(1);
}
if (!existsSync(path)) {
  console.error(`Tizen package not found: ${path}`);
  process.exit(1);
}
if (path.endsWith('.json')) {
  try {
    const metadata = JSON.parse(readFileSync(path, 'utf8'));
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('metadata must be an object');
    }
    console.log(
      'Metadata JSON structure only; cryptographic verification NOT performed. Supply actual WGT for signature verification.'
    );
  } catch (error) {
    console.error(`Invalid metadata JSON: ${error.message}`);
    process.exit(1);
  }
} else {
  const helper = fileURLToPath(new URL('./lib/tizen-signature-verify.py', import.meta.url));
  const result = spawnSync('python3', [helper, path], { stdio: 'inherit', timeout: 90000 });
  if (result.error) console.error(`Signature verifier unavailable: ${result.error.message}`);
  process.exit(result.status ?? 1);
}
