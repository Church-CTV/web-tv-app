/**
 * Production code-splitting gate — verify that the webOS build output
 * actually uses dynamic imports to reduce the entry-chunk size.
 *
 * TDD: these tests are written against the documented behavior of the
 * code-splitting checker BEFORE the implementation exists. They run in the
 * root vitest suite via the scripts glob include.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findEntryChunk, countLazyChunks, evaluateCodeSplit } from './code-split.mjs';

const KB = 1024;

let tmpDir;
let distDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-split-'));
  distDir = path.join(tmpDir, 'dist');
});

afterEach(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
});

describe('findEntryChunk', () => {
  it('returns the entry chunk filename when assets/index.<hash>.js exists', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'index.abc123.js'), '');
    fs.writeFileSync(path.join(assets, 'chunk.def456.js'), '');

    const entry = findEntryChunk(distDir);
    expect(entry).toBe('index.abc123.js');
  });

  it('returns null when no entry chunk is found', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'chunk.only.js'), '');

    const entry = findEntryChunk(distDir);
    expect(entry).toBeNull();
  });

  it('ignores .map files and .css files', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'index.abc123.js'), '');
    fs.writeFileSync(path.join(assets, 'index.abc123.js.map'), '');
    fs.writeFileSync(path.join(assets, 'index.abc123.css'), '');

    const entry = findEntryChunk(distDir);
    expect(entry).toBe('index.abc123.js');
  });
});

describe('countLazyChunks', () => {
  it('returns the number of non-entry .js files in the assets directory', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'index.abc123.js'), '');
    fs.writeFileSync(path.join(assets, 'chunk.schedule.js'), '');
    fs.writeFileSync(path.join(assets, 'chunk.continue.js'), '');

    const count = countLazyChunks(distDir);
    expect(count).toBe(2);
  });

  it('ignores .map source maps', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'index.abc123.js'), '');
    fs.writeFileSync(path.join(assets, 'index.abc123.js.map'), '');
    fs.writeFileSync(path.join(assets, 'chunk.schedule.js'), '');
    fs.writeFileSync(path.join(assets, 'chunk.schedule.js.map'), '');

    const count = countLazyChunks(distDir);
    expect(count).toBe(1);
  });

  it('returns 0 when only the entry chunk exists (no code splitting)', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'index.abc123.js'), '');

    const count = countLazyChunks(distDir);
    expect(count).toBe(0);
  });
});

describe('evaluateCodeSplit', () => {
  const baseConfig = {
    distDir: 'platforms/webos/dist',
    maxEntryKb: 55,
    minChunks: 2,
  };

  it('fails when no code splitting was performed (0 lazy chunks)', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(
      path.join(assets, 'index.abc123.js'),
      'x'.repeat(60 * KB) // 60 KB single chunk
    );

    const result = evaluateCodeSplit(distDir, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.entryKb).toBeGreaterThanOrEqual(60);
    expect(result.chunkCount).toBe(0);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.includes('code split'))).toBe(true);
  });

  it('fails when the entry chunk exceeds the maximum size budget', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(
      path.join(assets, 'index.abc123.js'),
      'x'.repeat(60 * KB) // 60 KB > 55 KB limit
    );
    fs.writeFileSync(path.join(assets, 'chunk.schedule.js'), 'y'.repeat(10 * KB));

    const result = evaluateCodeSplit(distDir, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.entryKb).toBeGreaterThanOrEqual(60);
    expect(result.failures.some((f) => f.includes('entry'))).toBe(true);
  });

  it('passes when code splitting was performed and entry is within budget', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(
      path.join(assets, 'index.abc123.js'),
      'x'.repeat(45 * KB) // 45 KB < 55 KB limit
    );
    fs.writeFileSync(path.join(assets, 'chunk.schedule.js'), 'y'.repeat(10 * KB));
    fs.writeFileSync(path.join(assets, 'chunk.continue.js'), 'z'.repeat(5 * KB));

    const result = evaluateCodeSplit(distDir, baseConfig);
    expect(result.pass).toBe(true);
    expect(result.entryKb).toBeLessThanOrEqual(55);
    expect(result.chunkCount).toBeGreaterThanOrEqual(2);
    expect(result.failures).toEqual([]);
  });

  it('fails when the entry chunk does not exist', () => {
    const assets = path.join(distDir, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'chunk.only.js'), 'x'.repeat(10 * KB));

    const result = evaluateCodeSplit(distDir, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.entryKb).toBeNull();
    expect(result.failures.some((f) => f.includes('entry'))).toBe(true);
  });
});
