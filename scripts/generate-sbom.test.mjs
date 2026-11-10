/**
 * J4b — Unit tests for scripts/generate-sbom.mjs
 *
 * Tests the pure helpers (parseLockfile, buildComponents, buildBom,
 * generateSboms) and the CycloneDX SBOM output format.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { parseLockfile, buildComponents, buildBom, generateSboms } from './generate-sbom.mjs';

/**
 * Create a temp directory structure that mimics the repo layout,
 * with a minimal package-lock.json.
 */
function makeRepoLayout() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'j4b-'));

  // Write a minimal but realistic package-lock.json
  const lock = {
    name: 'ctv-multi-platform',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'ctv-multi-platform',
        version: '1.0.0',
      },
      core: {
        name: '@ctv/core',
        version: '1.0.0',
      },
      'platforms/webos': {
        name: '@ctv/webos',
        version: '1.0.0',
      },
      'platforms/tizen': {
        name: '@ctv/tizen',
        version: '1.0.0',
      },
      'platforms/vizio': {
        name: '@ctv/vizio',
        version: '1.0.0',
      },
      'node_modules/vite': {
        name: 'vite',
        version: '5.4.0',
        resolved: 'https://registry.npmjs.org/vite/-/vite-5.4.0.tgz',
        integrity: 'sha512-testintegrityvite==',
        license: 'MIT',
        dev: true,
      },
      'node_modules/typescript': {
        name: 'typescript',
        version: '5.4.0',
        resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.4.0.tgz',
        integrity: 'sha512-testintegrityts==',
        license: 'Apache-2.0',
        dev: true,
      },
      'node_modules/@types/node': {
        name: '@types/node',
        version: '20.0.0',
        resolved: 'https://registry.npmjs.org/@types/node/-/node-20.0.0.tgz',
        integrity: 'sha512-testintegritytypes==',
        license: 'MIT',
        dev: true,
      },
    },
  };

  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock, null, 2));

  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe('J4b: parseLockfile', () => {
  it('reads and returns a valid lockfile object', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    expect(lockfile.name).toBe('ctv-multi-platform');
    expect(lockfile.lockfileVersion).toBe(3);
    expect(lockfile.packages).toBeDefined();
    layout.cleanup();
  });

  it('throws when lockfile does not exist', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4b-'));
    expect(() => parseLockfile(tempDir)).toThrow(/not found/i);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws when lockfileVersion is not supported', () => {
    const layout = makeRepoLayout();
    const lockPath = path.join(layout.root, 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    lock.lockfileVersion = 1; // unsupported
    fs.writeFileSync(lockPath, JSON.stringify(lock));
    expect(() => parseLockfile(layout.root)).toThrow(/unsupported/i);
    layout.cleanup();
  });
});

describe('J4b: buildComponents', () => {
  it('returns an array of CycloneDX components', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const components = buildComponents(lockfile);
    expect(Array.isArray(components)).toBe(true);
    expect(components.length).toBeGreaterThan(0);
    layout.cleanup();
  });

  it('includes name, version, type, and purl for each component', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const components = buildComponents(lockfile);
    const vite = components.find((c) => c.name === 'vite');
    expect(vite).toBeDefined();
    expect(vite.name).toBe('vite');
    expect(vite.version).toBe('5.4.0');
    expect(vite.type).toBe('library');
    expect(vite.purl).toBe('pkg:npm/vite@5.4.0');
    layout.cleanup();
  });

  it('encodes scoped package names in purl', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const components = buildComponents(lockfile);
    const typesNode = components.find((c) => c.name === '@types/node');
    expect(typesNode).toBeDefined();
    expect(typesNode.purl).toBe('pkg:npm/%40types%2Fnode@20.0.0');
    layout.cleanup();
  });

  it('includes hash when available', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const components = buildComponents(lockfile);
    const vite = components.find((c) => c.name === 'vite');
    expect(vite.hashes).toBeDefined();
    expect(vite.hashes).toHaveLength(1);
    expect(vite.hashes[0].alg).toBe('SHA-512');
    expect(vite.hashes[0].content).toBe('testintegrityvite==');
    layout.cleanup();
  });

  it('includes license when available', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const components = buildComponents(lockfile);
    const vite = components.find((c) => c.name === 'vite');
    expect(vite.licenses).toBeDefined();
    expect(vite.licenses).toHaveLength(1);
    expect(vite.licenses[0].license.id).toBe('MIT');
    layout.cleanup();
  });

  it('excludes workspace packages (no node_modules prefix)', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const components = buildComponents(lockfile);
    const names = components.map((c) => c.name);
    expect(names).not.toContain('@ctv/core');
    expect(names).not.toContain('@ctv/webos');
    expect(names).not.toContain('@ctv/tizen');
    expect(names).not.toContain('@ctv/vizio');
    layout.cleanup();
  });
});

describe('J4b: buildBom', () => {
  it('returns a CycloneDX SBOM object with correct metadata', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const bom = buildBom(lockfile, {
      bomRef: 'test-bom-ref',
      name: 'test-app',
      version: '1.0.0',
      description: 'Test application SBOM',
    });
    expect(bom.bomFormat).toBe('CycloneDX');
    expect(bom.specVersion).toBe('1.5');
    expect(bom.version).toBe(1);
    expect(bom.metadata).toBeDefined();
    expect(bom.metadata.tools).toBeDefined();
    expect(bom.metadata.component).toBeDefined();
    expect(bom.metadata.component.name).toBe('test-app');
    expect(bom.metadata.component.version).toBe('1.0.0');
    layout.cleanup();
  });

  it('includes the components array', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const bom = buildBom(lockfile, {
      bomRef: 'test-bom-ref',
      name: 'test-app',
      version: '1.0.0',
    });
    expect(bom.components).toBeDefined();
    expect(Array.isArray(bom.components)).toBe(true);
    expect(bom.components.length).toBeGreaterThan(0);
    layout.cleanup();
  });

  it('uses the provided bomRef', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const bom = buildBom(lockfile, {
      bomRef: 'my-custom-bom-ref',
      name: 'test-app',
      version: '1.0.0',
    });
    expect(bom.metadata.component.bomRef).toBe('my-custom-bom-ref');
    layout.cleanup();
  });

  it('includes description when provided', () => {
    const layout = makeRepoLayout();
    const lockfile = parseLockfile(layout.root);
    const bom = buildBom(lockfile, {
      bomRef: 'test-bom-ref',
      name: 'test-app',
      version: '1.0.0',
      description: 'A test description',
    });
    expect(bom.metadata.component.description).toBe('A test description');
    layout.cleanup();
  });
});

describe('J4b: generateSboms', () => {
  it('writes SBOM files for all three platforms', () => {
    const layout = makeRepoLayout();
    const outDir = path.join(layout.root, 'sboms');
    const results = generateSboms(layout.root, outDir);

    expect(results).toHaveLength(3);

    const fileNames = results.map((r) => path.basename(r.filePath)).sort();
    expect(fileNames).toContain('@ctv_webos-1.0.0-cyclonedx.json');
    expect(fileNames).toContain('@ctv_tizen-1.0.0-cyclonedx.json');
    expect(fileNames).toContain('@ctv_vizio-1.0.0-cyclonedx.json');

    // Verify each file is valid JSON with correct structure
    for (const result of results) {
      const content = JSON.parse(fs.readFileSync(result.filePath, 'utf-8'));
      expect(content.bomFormat).toBe('CycloneDX');
      expect(content.specVersion).toBe('1.5');
      expect(content.components).toBeDefined();
    }

    layout.cleanup();
  });

  it('creates the output directory if it does not exist', () => {
    const layout = makeRepoLayout();
    const outDir = path.join(layout.root, 'sboms', 'nested');
    generateSboms(layout.root, outDir);

    expect(fs.existsSync(path.join(outDir, '@ctv_webos-1.0.0-cyclonedx.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '@ctv_tizen-1.0.0-cyclonedx.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '@ctv_vizio-1.0.0-cyclonedx.json'))).toBe(true);

    layout.cleanup();
  });

  it('includes platform-specific metadata in each SBOM', () => {
    const layout = makeRepoLayout();
    const outDir = path.join(layout.root, 'sboms');
    generateSboms(layout.root, outDir);

    const webosSbom = JSON.parse(
      fs.readFileSync(path.join(outDir, '@ctv_webos-1.0.0-cyclonedx.json'), 'utf-8')
    );
    expect(webosSbom.metadata.component.name).toBe('@ctv/webos');
    expect(webosSbom.metadata.component.description).toContain('webOS');

    const tizenSbom = JSON.parse(
      fs.readFileSync(path.join(outDir, '@ctv_tizen-1.0.0-cyclonedx.json'), 'utf-8')
    );
    expect(tizenSbom.metadata.component.name).toBe('@ctv/tizen');

    const vizioSbom = JSON.parse(
      fs.readFileSync(path.join(outDir, '@ctv_vizio-1.0.0-cyclonedx.json'), 'utf-8')
    );
    expect(vizioSbom.metadata.component.name).toBe('@ctv/vizio');

    layout.cleanup();
  });

  it('handles missing package-lock.json gracefully', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j4b-'));
    const outDir = path.join(tempDir, 'sboms');

    expect(() => generateSboms(tempDir, outDir)).toThrow(/package-lock\.json/i);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
