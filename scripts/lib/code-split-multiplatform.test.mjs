/**
 * Multi-platform code-splitting gate — verify ALL platforms use dynamic imports.
 *
 * TDD: tests for multi-platform support BEFORE implementation.
 * Each platform's dist must have entry chunk + lazy chunks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateAllCodeSplit } from './code-split-multiplatform.mjs';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-split-multi-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Create a fake dist directory for a platform.
 * @param {string} platformName - e.g., 'webos', 'tizen', 'vizio'
 * @param {number} entrySizeKb - Size of entry chunk in KB
 * @param {number} lazyChunkCount - Number of lazy chunks to create
 */
function createFakeDist(platformName, entrySizeKb = 20, lazyChunkCount = 3) {
  const distDir = path.join(tmpDir, 'platforms', platformName, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  // Create entry chunk with correct naming pattern
  const entryBytes = entrySizeKb * 1024;
  fs.writeFileSync(path.join(assetsDir, `index.abc123.js`), 'x'.repeat(entryBytes));

  // Create lazy chunks
  for (let i = 0; i < lazyChunkCount; i++) {
    fs.writeFileSync(
      path.join(assetsDir, `chunk-${i}.def${i}.js`),
      'y'.repeat(5 * 1024) // 5 KB each
    );
  }

  // Create source maps (should be ignored)
  fs.writeFileSync(path.join(assetsDir, 'index.abc123.js.map'), '{}');
  fs.writeFileSync(path.join(assetsDir, 'chunk-0.def0.js.map'), '{}');

  return distDir;
}

describe('evaluateAllCodeSplit', () => {
  it('should pass when all platforms have code splitting', () => {
    // Create well-formed dist directories for all platforms
    createFakeDist('webos', 20, 4);
    createFakeDist('tizen', 15, 3);
    createFakeDist('vizio', 12, 3);

    const config = {
      maxEntryKb: 55,
      minChunks: 2,
      platforms: ['webos', 'tizen', 'vizio'],
    };

    const result = evaluateAllCodeSplit(tmpDir, config);

    expect(result.pass).toBe(true);
    expect(result.results.length).toBe(3);

    // Each platform should have its own result
    const webosResult = result.results.find((r) => r.platform === 'webos');
    const tizenResult = result.results.find((r) => r.platform === 'tizen');
    const vizioResult = result.results.find((r) => r.platform === 'vizio');

    expect(webosResult).toBeDefined();
    expect(tizenResult).toBeDefined();
    expect(vizioResult).toBeDefined();

    expect(webosResult.pass).toBe(true);
    expect(tizenResult.pass).toBe(true);
    expect(vizioResult.pass).toBe(true);
  });

  it('should fail when any platform lacks code splitting', () => {
    // webos: good
    createFakeDist('webos', 20, 4);
    // tizen: NO lazy chunks (bad)
    createFakeDist('tizen', 40, 0);
    // vizio: good
    createFakeDist('vizio', 12, 3);

    const config = {
      maxEntryKb: 55,
      minChunks: 2,
      platforms: ['webos', 'tizen', 'vizio'],
    };

    const result = evaluateAllCodeSplit(tmpDir, config);

    expect(result.pass).toBe(false);

    // Find the failing platform
    const tizenResult = result.results.find((r) => r.platform === 'tizen');
    expect(tizenResult.pass).toBe(false);
    expect(tizenResult.chunkCount).toBe(0);
    expect(tizenResult.failures.some((f) => f.includes('code split'))).toBe(true);
  });

  it('should fail when platform entry exceeds budget', () => {
    // webos: entry too big
    createFakeDist('webos', 60, 4);
    // tizen: good
    createFakeDist('tizen', 15, 3);
    // vizio: good
    createFakeDist('vizio', 12, 3);

    const config = {
      maxEntryKb: 55,
      minChunks: 2,
      platforms: ['webos', 'tizen', 'vizio'],
    };

    const result = evaluateAllCodeSplit(tmpDir, config);

    expect(result.pass).toBe(false);

    const webosResult = result.results.find((r) => r.platform === 'webos');
    expect(webosResult.pass).toBe(false);
    expect(webosResult.failures.some((f) => f.includes('entry'))).toBe(true);
  });

  it('should handle missing dist directory gracefully', () => {
    // Only create webos dist
    createFakeDist('webos', 20, 4);

    const config = {
      maxEntryKb: 55,
      minChunks: 2,
      platforms: ['webos', 'tizen', 'vizio'],
    };

    const result = evaluateAllCodeSplit(tmpDir, config);

    expect(result.pass).toBe(false);

    const tizenResult = result.results.find((r) => r.platform === 'tizen');
    expect(tizenResult.pass).toBe(false);
    expect(tizenResult.failures[0]).toContain('not found');
  });

  it('should report per-platform statistics', () => {
    createFakeDist('webos', 19, 12);
    createFakeDist('tizen', 15, 3);
    createFakeDist('vizio', 12, 3);

    const config = {
      maxEntryKb: 55,
      minChunks: 2,
      platforms: ['webos', 'tizen', 'vizio'],
    };

    const result = evaluateAllCodeSplit(tmpDir, config);

    expect(result.pass).toBe(true);

    // Check reported statistics
    const webosResult = result.results.find((r) => r.platform === 'webos');
    expect(webosResult.entryKb).toBeCloseTo(19, 0);
    expect(webosResult.chunkCount).toBe(12);
  });
});
