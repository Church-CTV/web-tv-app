/**
 * Tests for scripts/check-package-assets.mjs.
 *
 * The helper reads each platform's manifest (appinfo.json / config.xml /
 * manifest.json), extracts the image assets it references, and verifies that
 * each referenced asset exists in the staged payload AND is > 1 KB (store
 * review rejects empty / 1-pixel art). We test the pure extraction and the
 * verify logic against temp fixtures so we don't require a real package.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  assetsFromWebOSAppInfo,
  assetsFromTizenConfig,
  assetsFromVizioManifest,
  verifyStagedAssets,
} from './check-package-assets.mjs';

describe('assetsFromWebOSAppInfo', () => {
  it('collects icon, largeIcon, bgImage, splashBackground', () => {
    const appinfo = {
      icon: 'assets/icon-80.png',
      largeIcon: 'assets/icon-130.png',
      bgImage: 'assets/splash.png',
      splashBackground: 'assets/splash.png',
    };
    expect(assetsFromWebOSAppInfo(appinfo)).toEqual([
      'assets/icon-80.png',
      'assets/icon-130.png',
      'assets/splash.png',
    ]);
  });

  it('dedupes repeated references', () => {
    const appinfo = {
      icon: 'assets/icon-80.png',
      bgImage: 'assets/splash.png',
      splashBackground: 'assets/splash.png',
    };
    expect(assetsFromWebOSAppInfo(appinfo)).toEqual(['assets/icon-80.png', 'assets/splash.png']);
  });

  it('returns empty when no asset fields', () => {
    expect(assetsFromWebOSAppInfo({ id: 'x', version: '1' })).toEqual([]);
  });
});

describe('assetsFromTizenConfig', () => {
  it('collects the <icon src> reference', () => {
    const xml = `<widget>
      <icon src="assets/icon.png"/>
      <content src="index.html"/>
    </widget>`;
    expect(assetsFromTizenConfig(xml)).toEqual(['assets/icon.png']);
  });

  it('handles self-closing vs slash-close', () => {
    expect(assetsFromTizenConfig(`<widget><icon src="assets/a.png"></icon></widget>`)).toEqual([
      'assets/a.png',
    ]);
    expect(assetsFromTizenConfig(`<widget><icon src="assets/b.png"/></widget>`)).toEqual([
      'assets/b.png',
    ]);
  });

  it('returns empty when no icon element', () => {
    expect(assetsFromTizenConfig('<widget></widget>')).toEqual([]);
  });
});

describe('assetsFromVizioManifest', () => {
  it('collects all values from the icons map', () => {
    const manifest = { icons: { 120: 'assets/icon-120.png' } };
    expect(assetsFromVizioManifest(manifest)).toEqual(['assets/icon-120.png']);
  });

  it('collects multiple icon sizes', () => {
    const manifest = { icons: { 80: 'assets/icon-80.png', 130: 'assets/icon-130.png' } };
    expect(assetsFromVizioManifest(manifest).sort()).toEqual([
      'assets/icon-130.png',
      'assets/icon-80.png',
    ]);
  });

  it('returns empty when no icons', () => {
    expect(assetsFromVizioManifest({ name: 'x' })).toEqual([]);
  });
});

describe('verifyStagedAssets', () => {
  function makeStaged(platformDir, assets) {
    fs.mkdirSync(platformDir, { recursive: true });
    for (const [rel, size] of assets) {
      const p = path.join(platformDir, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.alloc(size, 1));
    }
    return platformDir;
  }

  it('passes when all referenced assets exist and exceed the size floor', () => {
    const dir = makeStaged(fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-')), [
      ['assets/icon-80.png', 5000],
      ['assets/icon-130.png', 6000],
      ['assets/splash.png', 4000],
    ]);
    try {
      const r = verifyStagedAssets(dir, [
        'assets/icon-80.png',
        'assets/icon-130.png',
        'assets/splash.png',
      ]);
      expect(r.ok).toBe(true);
      expect(r.missing).toEqual([]);
      expect(r.tooSmall).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags a referenced asset that is missing from the stage', () => {
    const dir = makeStaged(fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-')), [
      ['assets/icon-80.png', 5000],
    ]);
    try {
      const r = verifyStagedAssets(dir, ['assets/icon-80.png', 'assets/splash.png']);
      expect(r.ok).toBe(false);
      expect(r.missing).toEqual(['assets/splash.png']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags a referenced asset that is under the 1 KB floor', () => {
    const dir = makeStaged(fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-')), [
      ['assets/icon-80.png', 5000],
      ['assets/splash.png', 500], // 500 bytes = 0.5 KB, below floor
    ]);
    try {
      const r = verifyStagedAssets(dir, ['assets/icon-80.png', 'assets/splash.png']);
      expect(r.ok).toBe(false);
      expect(r.tooSmall).toEqual(['assets/splash.png']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts an asset exactly at the size floor boundary (>=1KB is ok)', () => {
    const dir = makeStaged(fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-')), [
      ['assets/icon-80.png', 1024],
    ]);
    try {
      const r = verifyStagedAssets(dir, ['assets/icon-80.png']);
      expect(r.ok).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes with no required assets (nothing to verify)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-'));
    try {
      const r = verifyStagedAssets(dir, []);
      expect(r.ok).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
