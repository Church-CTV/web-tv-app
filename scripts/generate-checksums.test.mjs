/**
 * J4a — Unit tests for scripts/generate-checksums.mjs
 *
 * Tests the pure helpers (hashFile, resolveRelPath, generateChecksums,
 * writeChecksums) and the sha256sum-compatible output format.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import {
  hashFile,
  resolveRelPath,
  generateChecksums,
  writeChecksums,
} from './generate-checksums.mjs';

/** Create a temp dir structure that mimics the CI packaging layout. */
function makeLayout() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'j4a-'));
  const webosBuild = path.join(root, 'platforms', 'webos', 'build');
  const tizenBuild = path.join(root, 'platforms', 'tizen', 'build');
  const vizioBuild = path.join(root, 'platforms', 'vizio', 'build');
  [webosBuild, tizenBuild, vizioBuild].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  const ipk = path.join(webosBuild, 'com.chroma.webos-1.0.0.ipk');
  const wgt = path.join(tizenBuild, 'chroma-channel.wgt');
  const zip = path.join(vizioBuild, 'chroma-channel-1.0.0.zip');
  fs.writeFileSync(ipk, 'ipk bytes');
  fs.writeFileSync(wgt, 'wgt bytes');
  fs.writeFileSync(zip, 'zip bytes');

  return {
    root,
    ipk,
    wgt,
    zip,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe('J4a: hashFile', () => {
  it('computes correct SHA256 for known content', () => {
    const layout = makeLayout();
    const expected = crypto.createHash('sha256').update('ipk bytes').digest('hex');
    expect(hashFile(layout.ipk)).toBe(expected);
    layout.cleanup();
  });

  it('returns 64-char lowercase hex', () => {
    const layout = makeLayout();
    expect(hashFile(layout.ipk)).toMatch(/^[0-9a-f]{64}$/);
    layout.cleanup();
  });

  it('throws on non-existent file', () => {
    expect(() => hashFile('/nonexistent/file.ipk')).toThrow();
  });
});

describe('J4a: resolveRelPath', () => {
  it('returns basename when no baseDir given', () => {
    expect(resolveRelPath('/a/b/c/ipk.wgt')).toBe('ipk.wgt');
  });

  it('returns relative path when file is under baseDir', () => {
    const layout = makeLayout();
    const rel = resolveRelPath(layout.ipk, layout.root);
    expect(rel).toBe('platforms/webos/build/com.chroma.webos-1.0.0.ipk');
    layout.cleanup();
  });

  it('returns basename when file is outside baseDir', () => {
    const layout = makeLayout();
    const outside = path.join(layout.root, 'other.ipk');
    fs.writeFileSync(outside, 'x');
    const rel = resolveRelPath(outside, '/nonexistent/base');
    expect(rel).toBe('other.ipk');
    layout.cleanup();
  });
});

describe('J4a: generateChecksums (basename mode)', () => {
  it('returns "hash  basename" lines for existing files', () => {
    const layout = makeLayout();
    const lines = generateChecksums([layout.ipk]);
    const expectedHash = crypto.createHash('sha256').update('ipk bytes').digest('hex');
    expect(lines).toEqual([`${expectedHash}  com.chroma.webos-1.0.0.ipk`]);
    layout.cleanup();
  });

  it('skips non-existent files', () => {
    const layout = makeLayout();
    const lines = generateChecksums([layout.ipk, '/nonexistent/fake.wgt']);
    expect(lines).toHaveLength(1);
    layout.cleanup();
  });

  it('returns empty array for all non-existent files', () => {
    expect(generateChecksums(['/nonexistent/ipk1', '/nonexistent/ipk2'])).toEqual([]);
  });
});

describe('J4a: generateChecksums (baseDir mode - CI layout)', () => {
  it('produces relative paths matching CI packaging job layout', () => {
    const layout = makeLayout();
    const files = [layout.ipk, layout.wgt, layout.zip];
    const lines = generateChecksums(files, layout.root);

    expect(lines).toHaveLength(3);
    expect(lines[0].endsWith('platforms/webos/build/com.chroma.webos-1.0.0.ipk')).toBe(true);
    expect(lines[1].endsWith('platforms/tizen/build/chroma-channel.wgt')).toBe(true);
    expect(lines[2].endsWith('platforms/vizio/build/chroma-channel-1.0.0.zip')).toBe(true);

    // All hashes are 64-char hex
    for (const line of lines) {
      expect(line).toMatch(/^[0-9a-f]{64}  platforms\/(webos|tizen|vizio)\/build\/.+$/);
    }
    layout.cleanup();
  });
});

describe('J4a: writeChecksums', () => {
  it('writes sha256sum-compatible file', () => {
    const layout = makeLayout();
    const outPath = path.join(layout.root, 'checksums.txt');
    const lines = writeChecksums([layout.ipk, layout.wgt, layout.zip], outPath, layout.root);

    expect(lines).toHaveLength(3);
    expect(fs.existsSync(outPath)).toBe(true);

    const content = fs.readFileSync(outPath, 'utf8');
    expect(content).toBe(lines.join('\n') + '\n');
    layout.cleanup();
  });

  it('creates parent directory if needed', () => {
    const layout = makeLayout();
    const nestedOut = path.join(layout.root, 'artifacts', 'checksums.txt');
    writeChecksums([layout.ipk], nestedOut, layout.root);
    expect(fs.existsSync(nestedOut)).toBe(true);
    layout.cleanup();
  });

  it('throws when no valid files given', () => {
    const layout = makeLayout();
    const outPath = path.join(layout.root, 'checksums.txt');
    expect(() => writeChecksums(['/nonexistent/ipk1'], outPath)).toThrow(/No files found/);
    layout.cleanup();
  });
});

describe('J4a: end-to-end sha256sum -c verification', () => {
  let layout;
  let childProcess;

  beforeEach(async () => {
    layout = makeLayout();
    childProcess = await import('node:child_process');
  });
  afterEach(() => {
    layout.cleanup();
  });

  it('output of writeChecksums is verifiable via sha256sum -c', () => {
    const outPath = path.join(layout.root, 'checksums.txt');
    writeChecksums([layout.ipk, layout.wgt, layout.zip], outPath, layout.root);

    // Run sha256sum -c from the root dir
    const result = childProcess.execSync(`sha256sum -c checksums.txt`, {
      cwd: layout.root,
      encoding: 'utf8',
    });

    expect(result.trim().split('\n')).toHaveLength(3);
    for (const line of result.trim().split('\n')) {
      expect(line).toMatch(/: OK$/);
    }
  });
});
