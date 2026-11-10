import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMeta } from '../../scripts/package-meta.mjs';
const workflow = readFileSync('.github/workflows/release.yaml', 'utf8');
describe('diagnostic package rehearsal, not a public release', () => {
  it('does not upload, publish, sign, install or silently certify artifacts', () => {
    expect(workflow).not.toMatch(/upload-artifact|action-gh-release|gh release|--sign|--upload|tizen install|check-store-ready/);
    expect(workflow).toContain('no publication');
    expect(workflow).toContain('on: workflow_dispatch');
    expect(workflow).not.toContain('tags:');
  });
  it('requires all packages and reproducibility before computing checksums', () => {
    const packageStep = workflow.indexOf('run: npm run package:local');
    const repro = workflow.indexOf('run: node scripts/check-reproducible-packages.mjs');
    const hashes = workflow.indexOf('run: sha256sum');
    expect(packageStep).toBeGreaterThan(0);
    expect(repro).toBeGreaterThan(packageStep);
    expect(hashes).toBeGreaterThan(repro);
    for (const platform of ['webos', 'tizen', 'vizio']) expect(workflow.slice(hashes)).toContain('platforms/' + platform + '/build/');
  });
  it('cannot mislabel a fallback webOS archive as store-ready', () => {
    const metadata = buildMeta('tar', { appId: 'org.example.channel', version: '1.0.0', file: 'diagnostic.ipk' });
    expect(metadata.storeReady).toBe(false);
    expect(metadata.packager).toBe('tar');
    expect(() => buildMeta('unknown', {})).toThrow();
  });
});
