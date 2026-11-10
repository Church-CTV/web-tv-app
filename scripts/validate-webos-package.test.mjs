import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('WEB-012: webOS package validation', () => {
  const metaFixture = join(__dirname, '..', 'tmp-webos-package-meta.json');
  const script = join(__dirname, 'validate-webos-package.mjs');

  function runValidation(meta) {
    writeFileSync(metaFixture, JSON.stringify(meta, null, 2));
    try {
      const result = execSync(`node ${script} ${metaFixture}`, {
        encoding: 'utf8',
        timeout: 10000,
      });
      return { code: 0, output: result };
    } catch (e) {
      return { code: e.status || 1, output: (e.stdout || '') + (e.stderr || '') };
    } finally {
      rmSync(metaFixture, { force: true });
    }
  }

  it('rejects missing metadata', () => {
    const result = runValidation({ packager: 'ares' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('Missing required field');
  });

  it('rejects tar (diagnostic) packages', () => {
    const result = runValidation({
      packager: 'tar',
      storeReady: false,
      appId: 'com.test.app',
      version: '1.0.0',
      file: 'test.ipk',
    });
    expect(result.code).toBe(1);
    expect(result.output).toContain('tar');
  });

  it('rejects non-store-ready ares packages', () => {
    const result = runValidation({
      packager: 'ares',
      storeReady: false,
      appId: 'com.test.app',
      version: '1.0.0',
      file: 'test.ipk',
    });
    expect(result.code).toBe(1);
    expect(result.output).toContain('not marked store-ready');
  });

  it('passes valid ares package metadata (no file check)', () => {
    const result = runValidation({
      packager: 'ares',
      storeReady: true,
      appId: 'com.test.app',
      version: '1.0.0',
      file: '',
    });
    expect(result.code).toBe(0);
    expect(result.output).toContain('Package valid');
  });
});