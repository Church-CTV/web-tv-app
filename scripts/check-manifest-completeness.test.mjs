/**
 * Tests for scripts/check-manifest-completeness.mjs.
 *
 * Pure-function unit tests cover the parsers/validators. Integration tests
 * read the REAL repo manifests so a missing privilege or field fails the suite
 * instead of silently shipping a package that cannot reach the network.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TIZEN_INTERNET_PRIVILEGE,
  TIZEN_SCREEN_FEATURE,
  tizenPrivileges,
  tizenFeatures,
  tizenManifestCompleteness,
  vizioManifestCompleteness,
  completenessForPlatform,
} from './check-manifest-completeness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

describe('tizenPrivileges', () => {
  it('extracts every declared privilege in order', () => {
    const xml = [
      '<widget>',
      `  <tizen:privilege name="${TIZEN_INTERNET_PRIVILEGE}"/>`,
      '  <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>',
      '</widget>',
    ].join('\n');
    expect(tizenPrivileges(xml)).toEqual([
      TIZEN_INTERNET_PRIVILEGE,
      'http://tizen.org/privilege/tv.inputdevice',
    ]);
  });

  it('handles single and double quotes and self-close variants', () => {
    expect(tizenPrivileges(`<w><tizen:privilege name='${TIZEN_INTERNET_PRIVILEGE}'/></w>`)).toEqual(
      [TIZEN_INTERNET_PRIVILEGE]
    );
  });

  it('returns empty when no privileges are declared', () => {
    expect(tizenPrivileges('<widget></widget>')).toEqual([]);
  });
});

describe('tizenFeatures', () => {
  it('extracts every declared <feature> in order', () => {
    const xml = [
      '<widget>',
      `  <feature name="${TIZEN_SCREEN_FEATURE}"/>`,
      '  <feature name="http://tizen.org/feature/camera"/>',
      '</widget>',
    ].join('\n');
    expect(tizenFeatures(xml)).toEqual([TIZEN_SCREEN_FEATURE, 'http://tizen.org/feature/camera']);
  });

  it('handles single quotes', () => {
    expect(tizenFeatures(`<w><feature name='${TIZEN_SCREEN_FEATURE}'/></w>`)).toEqual([
      TIZEN_SCREEN_FEATURE,
    ]);
  });

  it('does not match tizen:privilege tags', () => {
    const xml = `<widget><tizen:privilege name="${TIZEN_INTERNET_PRIVILEGE}"/></widget>`;
    expect(tizenFeatures(xml)).toEqual([]);
  });
});

describe('tizenManifestCompleteness', () => {
  it('passes when the internet privilege AND screen feature are declared', () => {
    const xml = `<widget><tizen:privilege name="${TIZEN_INTERNET_PRIVILEGE}"/><feature name="${TIZEN_SCREEN_FEATURE}"/></widget>`;
    const r = tizenManifestCompleteness(xml);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.missingFeatures).toEqual([]);
  });

  it('fails closed when the internet privilege is absent', () => {
    const xml = `<widget><tizen:privilege name="http://tizen.org/privilege/productinfo"/><feature name="${TIZEN_SCREEN_FEATURE}"/></widget>`;
    const r = tizenManifestCompleteness(xml);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([TIZEN_INTERNET_PRIVILEGE]);
    expect(r.missingFeatures).toEqual([]);
  });

  it('fails closed when the screen feature is absent', () => {
    const xml = `<widget><tizen:privilege name="${TIZEN_INTERNET_PRIVILEGE}"/></widget>`;
    const r = tizenManifestCompleteness(xml);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([]);
    expect(r.missingFeatures).toEqual([TIZEN_SCREEN_FEATURE]);
  });

  it('supports extra required privileges', () => {
    const xml = `<widget><tizen:privilege name="${TIZEN_INTERNET_PRIVILEGE}"/><feature name="${TIZEN_SCREEN_FEATURE}"/></widget>`;
    const r = tizenManifestCompleteness(xml, [
      TIZEN_INTERNET_PRIVILEGE,
      'http://tizen.org/privilege/tv.inputdevice',
    ]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['http://tizen.org/privilege/tv.inputdevice']);
    expect(r.missingFeatures).toEqual([]);
  });
});

describe('vizioManifestCompleteness', () => {
  it('passes when every required field is present', () => {
    const manifest = {
      name: 'Chroma Channel',
      version: '0.1.0',
      main: 'index.html',
      start_url: 'index.html',
      icons: { 120: 'assets/icon-120.png' },
    };
    expect(vizioManifestCompleteness(manifest).ok).toBe(true);
  });

  it('fails closed when required fields are missing', () => {
    const r = vizioManifestCompleteness({ name: 'Chroma' });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['version', 'main', 'start_url', 'icons']);
  });

  it('treats an empty icons map as missing', () => {
    const r = vizioManifestCompleteness({
      name: 'Chroma',
      version: '0.1.0',
      main: 'index.html',
      start_url: 'index.html',
      icons: {},
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['icons']);
  });
});

describe('integration: real repo manifests', () => {
  it('Tizen config.xml declares the internet privilege (needed for network)', () => {
    const xml = fs.readFileSync(path.join(REPO_ROOT, 'platforms/tizen/config.xml'), 'utf8');
    const r = tizenManifestCompleteness(xml);
    expect(r).toEqual(expect.objectContaining({ ok: true }));
  });

  it('Tizen config.xml declares the required screen-size feature', () => {
    const xml = fs.readFileSync(path.join(REPO_ROOT, 'platforms/tizen/config.xml'), 'utf8');
    const r = tizenManifestCompleteness(xml);
    expect(r.features).toContain(TIZEN_SCREEN_FEATURE);
    expect(r.missingFeatures).toEqual([]);
  });

  it('Vizio manifest.json is complete for store submission', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'platforms/vizio/manifest.json'), 'utf8')
    );
    expect(vizioManifestCompleteness(manifest)).toEqual(expect.objectContaining({ ok: true }));
  });

  it('completenessForPlatform loads each real manifest and passes', () => {
    for (const platform of ['webos', 'tizen', 'vizio']) {
      const r = completenessForPlatform(path.join(REPO_ROOT, 'platforms', platform), platform);
      expect(r.ok, `${platform} should be manifest-complete: ${r.note}`).toBe(true);
    }
  });
});
