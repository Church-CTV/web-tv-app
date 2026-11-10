/**
 * WEB-010: Verify version alignment across all packages and manifests.
 * All version fields must match the canonical version defined in root package.json.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('version alignment', () => {
  // Canonical version: root package.json
  const rootPkg = readJson(resolve(ROOT, 'package.json'));
  const canonical = rootPkg.version;

  it('all package.json files match canonical version', () => {
    const pkgPaths = [
      'package.json',
      'core/package.json',
      'platforms/webos/package.json',
      'platforms/tizen/package.json',
      'platforms/vizio/package.json',
      'shared/contracts/package.json',
      'shared/ui/package.json',
    ];

    for (const relPath of pkgPaths) {
      const full = resolve(ROOT, relPath);
      const pkg = readJson(full);
      expect(pkg.version).toBe(canonical);
    }
  });

  it('webOS appinfo.json matches canonical version', () => {
    const appinfo = readJson(resolve(ROOT, 'platforms/webos/appinfo.json'));
    expect(appinfo.version).toBe(canonical);
  });

  it('Tizen config.xml has a well-formed store submission version', () => {
    const configXml = readFileSync(resolve(ROOT, 'platforms/tizen/config.xml'), 'utf-8');
    const match = configXml.match(/<widget[^>]*\s+version="([^"]+)"/);
    expect(match).not.toBeNull();
    // The config.xml version is the Samsung-store submission version for app
    // ChromaTV01, which follows the [0-255].[0-255].[0-65535] rule and is
    // decoupled from the monorepo NPM canonical version (the NPM versions are
    // asserted against the package.json files in the first test). The first
    // store submission uses 1.0.0 as the baseline; all updates must be higher.
    expect(match![1]).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,5}$/);
  });

  it('Vizio manifest.json matches canonical version', () => {
    const manifest = readJson(resolve(ROOT, 'platforms/vizio/manifest.json'));
    expect(manifest.version).toBe(canonical);
  });

  it('Vizio runtime APP_VERSION matches canonical version', () => {
    // Same defect class the webOS assertion above was written for, found on the Vizio
    // build on 2026-11-08 by the store gate (store-checklist VZ-PKG-04): the settings
    // line said "Version: 1.0.0" while the package was built as 0.1.0, so the number a
    // viewer read matched no artifact. The Vizio screen now renders version.ts, and this
    // assertion keeps that from drifting back.
    const src = readFileSync(resolve(ROOT, 'platforms/vizio/src/version.ts'), 'utf-8');
    const match = src.match(/export const APP_VERSION = '([^']+)'/);
    expect(
      match,
      'version.ts must keep the literal APP_VERSION export the app imports'
    ).not.toBeNull();
    expect(match![1]).toBe(canonical);
  });

  it('webOS runtime APP_VERSION matches canonical version', () => {
    // The settings screen shows this string as the channel version and the
    // support bundle reports it, so a viewer reading "1.0.0" on a build the
    // store lists as 0.1.0 gets a version that no artifact carries. Before this
    // assertion this was the one monorepo-aligned version field with no gate
    // (Tizen's config.xml version is a deliberately decoupled store number),
    // which is exactly how it drifted.
    const src = readFileSync(resolve(ROOT, 'platforms/webos/src/version.ts'), 'utf-8');
    const match = src.match(/export const APP_VERSION = '([^']+)'/);
    expect(
      match,
      'version.ts must keep the literal APP_VERSION export the app imports'
    ).not.toBeNull();
    expect(match![1]).toBe(canonical);
  });
});
