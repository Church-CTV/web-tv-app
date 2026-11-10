import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'validate-vizio-package.mjs');
const REPO_ROOT = join(__dirname, '..');

function runValidator(dir) {
  try {
    const result = execSync(`node ${SCRIPT} ${dir}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { exitCode: 0, output: result };
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    return { exitCode: e.status ?? 1, output: output };
  }
}

let tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'vizio-validator-'));

function makePkg(baseName, files, manifest) {
  const dir = join(tmpDir, baseName);
  fs.mkdirSync(dir, { recursive: true });
  if (manifest) {
    fs.writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
  for (const [name, content] of Object.entries(files || {})) {
    const path = join(dir, name);
    fs.mkdirSync(dirname(path), { recursive: true });
    fs.writeFileSync(path, content);
  }
  // Also create assets directory for icon tests
  fs.mkdirSync(join(dir, 'assets'), { recursive: true });
  return dir;
}

describe('Vizio package validator', () => {
  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails when no package directory is provided', () => {
    try {
      execSync(`node ${SCRIPT}`, { cwd: REPO_ROOT, timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
      expect(true).toBe(false);
    } catch (e) {
      expect(e.status).toBe(1);
      expect((e.stdout || '') + (e.stderr || '')).toContain('Usage');
    }
  });

  it('fails for missing package directory', () => {
    const r = runValidator('/nonexistent/package');
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('Package directory not found');
  });

  it('fails for empty directory', () => {
    const dir = makePkg('empty', {});
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('Missing manifest.json');
  });

  it('fails for invalid JSON manifest', () => {
    const dir = makePkg('invalid-json', {}, null);
    fs.writeFileSync(join(dir, 'manifest.json'), 'not valid json{');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('not valid JSON');
  });

  it('fails for missing name field', () => {
    const dir = makePkg('missing-name', { 'index.html': '<html></html>' }, {
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing required field: name');
  });

  it('fails for non-semantic version', () => {
    const dir = makePkg('bad-version', { 'index.html': '<html></html>' }, {
      name: "Test App",
      version: "not-semver",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('not valid semver');
  });

  it('fails for missing icons field', () => {
    const dir = makePkg('missing-icons', { 'index.html': '<html></html>' }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html"
    });
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing required field: icons');
  });

  it('fails for missing 120 icon', () => {
    const dir = makePkg('missing-120-icon', { 'index.html': '<html></html>' }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "240": "assets/icon-240.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-240.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('missing required 120x120 icon');
  });

  it('fails for non-existent icon files', () => {
    const dir = makePkg('missing-icon-file', { 'index.html': '<html></html>' }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('Icon file does not exist');
  });

  it('fails for missing main entry', () => {
    const dir = makePkg('missing-main', {}, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('main entry point does not exist');
  });

  it('accepts valid minimal package', () => {
    const dir = makePkg('valid-minimal', { 'index.html': '<html><body>Hello</body></html>' }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('Vizio package validation passed');
  });

  it('accepts package with extra valid fields', () => {
    const dir = makePkg('valid-extra', { 'index.html': '<html></html>' }, {
      name: "Full App",
      version: "2.3.1",
      main: "index.html",
      icons: { "120": "assets/icon-120.png", "240": "assets/icon-240.png" },
      orientation: "landscape",
      background_color: "#000000",
      minimum_version: "14.0",
      description: "A nice app"
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon-120');
    fs.writeFileSync(join(dir, 'assets/icon-240.png'), 'fake-icon-240');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(0);
  });

  it('fails for unexpected files (node_modules)', () => {
    const dir = makePkg('has-nodemodules', {
      'index.html': '<html></html>'
    }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    fs.mkdirSync(join(dir, 'node_modules'), { recursive: true });
    fs.writeFileSync(join(dir, 'node_modules/some-module.js'), 'module content');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('Unexpected file');
    expect(r.output).toContain('node_modules');
  });

  it('fails for unexpected files (coverage)', () => {
    const dir = makePkg('has-coverage', {
      'index.html': '<html></html>'
    }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    fs.mkdirSync(join(dir, 'coverage'), { recursive: true });
    fs.writeFileSync(join(dir, 'coverage/index.html'), 'coverage report');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('Unexpected file');
    expect(r.output).toContain('coverage');
  });

  it('fails for unexpected files (tsconfig)', () => {
    const dir = makePkg('has-tsconfig', {
      'index.html': '<html></html>'
    }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    fs.writeFileSync(join(dir, 'tsconfig.json'), '{"compilerOptions":{}}');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('Unexpected file');
    expect(r.output).toContain('tsconfig');
  });

  it('fails for invalid minimum_version format', () => {
    const dir = makePkg('bad-min-version', { 'index.html': '<html></html>' }, {
      name: "Test App",
      version: "1.0.0",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" },
      minimum_version: "not-a-version"
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain('minimum_version is not valid');
  });

  it('accepts semver with prerelease tag', () => {
    const dir = makePkg('prerelease-version', { 'index.html': '<html></html>' }, {
      name: "Test App",
      version: "2.0.0-rc.1",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(0);
  });

  it('accepts semver with build metadata', () => {
    const dir = makePkg('build-meta-version', { 'index.html': '<html></html>' }, {
      name: "Test App",
      version: "1.5.0+build.123",
      main: "index.html",
      icons: { "120": "assets/icon-120.png" }
    });
    fs.writeFileSync(join(dir, 'assets/icon-120.png'), 'fake-icon');
    const r = runValidator(dir);
    expect(r.exitCode).toBe(0);
  });
});
