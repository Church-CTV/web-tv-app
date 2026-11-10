#!/usr/bin/env node
/**
 * J4d — Unit tests for scripts/generate-provenance.mjs
 *
 * Proves that the provenance manifest script can:
 *   - extract source/build metadata from the GitHub Actions environment
 *   - record toolchain versions (node, npm, package-lock hash)
 *   - hash artifact files with SHA-256
 *   - match artifacts to their CycloneDX SBOMs by platform
 *   - cross-validate artifact hashes against a checksums.txt when present
 *   - write a valid, self-consistent provenance manifest
 *
 * Run: npx vitest run scripts/generate-provenance.test.mjs
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import {
  sha256Hex,
  extractSource,
  extractBuild,
  extractToolchain,
  buildArtifactEntry,
  loadSboms,
  buildProvenance,
} from './generate-provenance.mjs';

/** Create a temp directory structure that mimics the repo layout. */
function makeRepoLayout() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'j4d-'));

  // package-lock.json (minimal but realistic)
  const lock = {
    name: 'ctv-multi-platform',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'ctv-multi-platform', version: '1.0.0' },
      'platforms/webos': { name: '@ctv/webos', version: '1.0.0' },
      'platforms/tizen': { name: '@ctv/tizen', version: '1.0.0' },
      'platforms/vizio': { name: '@ctv/vizio', version: '1.0.0' },
    },
  };
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock, null, 2));

  // platform build directories with artifact files
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

  // sboms directory with cyclonedx files
  const sbomsDir = path.join(root, 'sboms');
  fs.mkdirSync(sbomsDir, { recursive: true });
  const sbomWebos = path.join(sbomsDir, '@ctv_webos-1.0.0-cyclonedx.json');
  const sbomTizen = path.join(sbomsDir, '@ctv_tizen-1.0.0-cyclonedx.json');
  const sbomVizio = path.join(sbomsDir, '@ctv_vizio-1.0.0-cyclonedx.json');
  fs.writeFileSync(sbomWebos, JSON.stringify({ bomFormat: 'CycloneDX', name: 'webos' }));
  fs.writeFileSync(sbomTizen, JSON.stringify({ bomFormat: 'CycloneDX', name: 'tizen' }));
  fs.writeFileSync(sbomVizio, JSON.stringify({ bomFormat: 'CycloneDX', name: 'vizio' }));

  return {
    root,
    ipk,
    wgt,
    zip,
    sbomsDir,
    sbomWebos,
    sbomTizen,
    sbomVizio,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe('J4d: sha256Hex', () => {
  it('computes correct SHA256 for known text', () => {
    const expected = crypto.createHash('sha256').update('ipk bytes').digest('hex');
    expect(sha256Hex('ipk bytes')).toBe(expected);
  });

  it('returns 64-char lowercase hex', () => {
    expect(sha256Hex('anything')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('J4d: extractSource', () => {
  it('extracts source metadata from environment', () => {
    const env = {
      GITHUB_REPOSITORY: 'example/web-tv',
      GITHUB_SHA: 'abc123def456',
      GITHUB_REF: 'refs/tags/v1.0.0',
      GITHUB_REPOSITORY_URL: 'https://github.com/example/web-tv',
    };
    const source = extractSource(env, 'abc123def456');
    expect(source.repository).toBe('example/web-tv');
    expect(source.sourceSha).toBe('abc123def456');
    expect(source.ref).toBe('refs/tags/v1.0.0');
    expect(source.refName).toBe('v1.0.0');
    expect(source.sourceUrl).toBe('https://github.com/example/web-tv');
  });

  it('handles missing environment variables gracefully', () => {
    const source = extractSource({}, 'fallback-sha');
    expect(source.sourceSha).toBe('fallback-sha');
    expect(source.repository).toBeUndefined();
    expect(source.ref).toBeUndefined();
    expect(source.refName).toBeUndefined();
  });
});

describe('J4d: extractBuild', () => {
  it('extracts build metadata from environment', () => {
    const env = {
      GITHUB_RUN_ID: '123456789',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_WORKFLOW: 'Release',
      GITHUB_RUN_URL: 'https://github.com/example/web-tv/actions/runs/123456789',
      RUNNER_NAME: 'webos',
      RUNNER_ARCH: 'X64',
      GITHUB_SERVER_URL: 'https://github.com',
    };
    const build = extractBuild(env);
    expect(build.runId).toBe('123456789');
    expect(build.runAttempt).toBe('2');
    expect(build.workflow).toBe('Release');
    expect(build.runUrl).toBe('https://github.com/example/web-tv/actions/runs/123456789');
    expect(build.runnerName).toBe('webos');
    expect(build.runnerArch).toBe('X64');
    expect(build.serverUrl).toBe('https://github.com');
  });

  it('handles missing environment variables gracefully', () => {
    const build = extractBuild({});
    expect(build.runId).toBeUndefined();
    expect(build.workflow).toBeUndefined();
    expect(build.runnerName).toBeUndefined();
  });
});

describe('J4d: extractToolchain', () => {
  it('extracts toolchain metadata from process.env and filesystem', () => {
    const layout = makeRepoLayout();
    const origNode = process.env.npm_config_user_agent;
    process.env.npm_config_user_agent = 'node/v20.11.0 npm/v10.2.4 linux x64';
    try {
      const toolchain = extractToolchain(layout.root);
      expect(toolchain.node).toBe('v20.11.0');
      expect(toolchain.npm).toBe('v10.2.4');
      // package-lock hash should be a 64-char hex
      expect(toolchain.packageLockSha256).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      if (origNode !== undefined) process.env.npm_config_user_agent = origNode;
      else delete process.env.npm_config_user_agent;
      layout.cleanup();
    }
  });

  it('returns undefined for missing toolchain info', () => {
    const origNode = process.env.npm_config_user_agent;
    delete process.env.npm_config_user_agent;
    try {
      const toolchain = extractToolchain('/nonexistent/path');
      expect(toolchain.node).toBeUndefined();
      expect(toolchain.npm).toBeUndefined();
      expect(toolchain.packageLockSha256).toBeUndefined();
    } finally {
      if (origNode !== undefined) process.env.npm_config_user_agent = origNode;
    }
  });
});

describe('J4d: buildArtifactEntry', () => {
  it('creates an artifact entry with correct metadata and hash', () => {
    const layout = makeRepoLayout();
    const entry = buildArtifactEntry(layout.ipk, layout.root, 'webos');
    expect(entry.path).toBe('platforms/webos/build/com.chroma.webos-1.0.0.ipk');
    expect(entry.platform).toBe('webos');
    expect(entry.type).toBe('ipk');
    expect(entry.name).toBe('com.chroma.webos-1.0.0.ipk');

    const expectedHash = crypto.createHash('sha256').update('ipk bytes').digest('hex');
    expect(entry.sha256).toBe(expectedHash);
    expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    layout.cleanup();
  });

  it('infers artifact type from file extension', () => {
    const layout = makeRepoLayout();
    const ipkEntry = buildArtifactEntry(layout.ipk, layout.root, 'webos');
    const wgtEntry = buildArtifactEntry(layout.wgt, layout.root, 'tizen');
    const zipEntry = buildArtifactEntry(layout.zip, layout.root, 'vizio');
    expect(ipkEntry.type).toBe('ipk');
    expect(wgtEntry.type).toBe('wgt');
    expect(zipEntry.type).toBe('zip');
    layout.cleanup();
  });

  it('throws on non-existent file', () => {
    expect(() => buildArtifactEntry('/nonexistent/file.ipk', '/base', 'webos')).toThrow();
  });
});

describe('J4d: loadSboms', () => {
  it('loads SBOMs from a directory with correct platform matching', () => {
    const layout = makeRepoLayout();
    const sboms = loadSboms(layout.sbomsDir);
    expect(sboms.webos).toBeDefined();
    expect(sboms.tizen).toBeDefined();
    expect(sboms.vizio).toBeDefined();

    // Verify the file paths are correct
    expect(sboms.webos.file).toBe(layout.sbomWebos);
    expect(sboms.tizen.file).toBe(layout.sbomTizen);
    expect(sboms.vizio.file).toBe(layout.sbomVizio);

    // Verify the hashes are computed
    expect(sboms.webos.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sboms.tizen.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sboms.vizio.sha256).toMatch(/^[0-9a-f]{64}$/);
    layout.cleanup();
  });

  it('returns empty object when directory does not exist', () => {
    const sboms = loadSboms('/nonexistent/sboms');
    expect(sboms).toEqual({});
  });

  it('ignores non-SBOM files in the directory', () => {
    const layout = makeRepoLayout();
    const extraFile = path.join(layout.sbomsDir, 'not-a-sbom.txt');
    fs.writeFileSync(extraFile, 'this is not an SBOM');
    const sboms = loadSboms(layout.sbomsDir);
    expect(sboms.webos).toBeDefined();
    expect(sboms.tizen).toBeDefined();
    expect(sboms.vizio).toBeDefined();
    expect(Object.keys(sboms)).toHaveLength(3);
    layout.cleanup();
  });
});

describe('J4d: buildProvenance (end-to-end)', () => {
  it('generates a complete, valid provenance manifest', () => {
    const layout = makeRepoLayout();
    const env = {
      GITHUB_REPOSITORY: 'example/web-tv',
      GITHUB_SHA: 'abc123def456',
      GITHUB_REF: 'refs/tags/v1.0.0',
      GITHUB_RUN_ID: '123456789',
      GITHUB_WORKFLOW: 'Release',
      RUNNER_NAME: 'webos',
      npm_config_user_agent: 'node/v20.11.0 npm/v10.2.4 linux x64',
    };

    const origNode = process.env.npm_config_user_agent;
    Object.keys(env).forEach((k) => (process.env[k] = env[k]));

    try {
      const outPath = path.join(layout.root, 'provenance.json');
      const provenance = buildProvenance(layout.root, outPath);

      // Verify the manifest was written
      expect(fs.existsSync(outPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      expect(parsed).toEqual(provenance);

      // Verify structure
      expect(provenance.version).toBe('1.0.0');
      expect(provenance.spec).toBe('slsaprovenance/v1');
      expect(provenance.source).toBeDefined();
      expect(provenance.build).toBeDefined();
      expect(provenance.toolchain).toBeDefined();
      expect(provenance.artifacts).toHaveLength(3);

      // Verify artifact hashes are correct
      const ipkHash = crypto.createHash('sha256').update('ipk bytes').digest('hex');
      const ipkArtifact = provenance.artifacts.find((a) => a.platform === 'webos');
      expect(ipkArtifact.sha256).toBe(ipkHash);
      layout.cleanup();
    } finally {
      if (origNode !== undefined) process.env.npm_config_user_agent = origNode;
      else delete process.env.npm_config_user_agent;
    }
  });

  it('matches artifacts to their SBOMs', () => {
    const layout = makeRepoLayout();
    const env = {
      GITHUB_SHA: 'abc123def456',
      npm_config_user_agent: 'node/v20.11.0 npm/v10.2.4 linux x64',
    };

    const origNode = process.env.npm_config_user_agent;
    Object.keys(env).forEach((k) => (process.env[k] = env[k]));

    try {
      const outPath = path.join(layout.root, 'provenance.json');
      const provenance = buildProvenance(layout.root, outPath);

      const ipkArtifact = provenance.artifacts.find((a) => a.platform === 'webos');
      expect(ipkArtifact.sbom).toBeDefined();
      expect(ipkArtifact.sbom.file).toContain('@ctv_webos');
      expect(ipkArtifact.sbom.sha256).toMatch(/^[0-9a-f]{64}$/);
      layout.cleanup();
    } finally {
      if (origNode !== undefined) process.env.npm_config_user_agent = origNode;
      else delete process.env.npm_config_user_agent;
    }
  });

  it('validates checksums.txt when provided', () => {
    const layout = makeRepoLayout();

    // Generate a checksums.txt file
    const realIpkHash = crypto.createHash('sha256').update('ipk bytes').digest('hex');
    const checksumPath = path.join(layout.root, 'checksums.txt');
    fs.writeFileSync(
      checksumPath,
      `${realIpkHash}  platforms/webos/build/com.chroma.webos-1.0.0.ipk\n`
    );

    const env = {
      GITHUB_SHA: 'abc123def456',
      npm_config_user_agent: 'node/v20.11.0 npm/v10.2.4 linux x64',
    };

    const origNode = process.env.npm_config_user_agent;
    Object.keys(env).forEach((k) => (process.env[k] = env[k]));

    try {
      const outPath = path.join(layout.root, 'provenance.json');
      const provenance = buildProvenance(layout.root, outPath, { checksumsFile: checksumPath });

      // Should not throw and should produce valid output
      expect(provenance.artifacts).toHaveLength(3);
      const ipkArtifact = provenance.artifacts.find((a) => a.platform === 'webos');
      expect(ipkArtifact.sha256).toBe(realIpkHash);
      layout.cleanup();
    } finally {
      if (origNode !== undefined) process.env.npm_config_user_agent = origNode;
      else delete process.env.npm_config_user_agent;
    }
  });

  it('throws when checksums.txt contains a mismatched hash', () => {
    const layout = makeRepoLayout();

    // Write a checksums.txt with an incorrect hash
    const checksumPath = path.join(layout.root, 'checksums.txt');
    const fakeHash = 'deadbeef'.repeat(8); // 64-char hex but wrong
    fs.writeFileSync(
      checksumPath,
      `${fakeHash}  platforms/webos/build/com.chroma.webos-1.0.0.ipk\n`
    );

    const env = {
      GITHUB_SHA: 'abc123def456',
      npm_config_user_agent: 'node/v20.11.0 npm/v10.2.4 linux x64',
    };

    const origNode = process.env.npm_config_user_agent;
    Object.keys(env).forEach((k) => (process.env[k] = env[k]));

    try {
      const outPath = path.join(layout.root, 'provenance.json');
      expect(() => buildProvenance(layout.root, outPath, { checksumsFile: checksumPath })).toThrow(
        /mismatch/i
      );
      layout.cleanup();
    } finally {
      if (origNode !== undefined) process.env.npm_config_user_agent = origNode;
      else delete process.env.npm_config_user_agent;
    }
  });
});
