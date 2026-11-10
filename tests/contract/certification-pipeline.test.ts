import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const release = readFileSync('.github/workflows/release.yaml', 'utf8');
describe('certification pipeline wiring', () => {
  it('captures fresh production screens and requires every platform page', () => {
    expect(ci).toContain('node scripts/capture-certification-pages.mjs');
    expect(ci.indexOf('Production build all platforms')).toBeLessThan(
      ci.indexOf('node scripts/capture-certification-pages.mjs')
    );
    expect(ci).toContain('loadCertificationPages');
    expect(ci).not.toMatch(/empty-placeholder|core_app\.txt|Created skeleton|cp "\$IDX"/);
    expect(ci.match(/run: npm ci/g)).toHaveLength(1);
  });
  it('provisions the real signature verifier before tests and release packaging', () => {
    for (const workflow of [ci, release]) {
      expect(workflow).toContain('sudo apt-get install -y --no-install-recommends xmlsec1 openssl');
      expect(workflow).toContain('xmlsec1 --version');
    }
    expect(ci.indexOf('xmlsec1 --version')).toBeLessThan(ci.indexOf('Root aggregate coverage'));
    expect(release.indexOf('xmlsec1 --version')).toBeLessThan(
      release.indexOf('Package Tizen (.wgt, signed)')
    );
  });
  it('requires exact SHA certification before release packaging', () => {
    expect(release).toContain('actions: read');
    expect(release).toContain('GITHUB_SHA: ${{ github.sha }}');
    expect(release).toContain('GH_TOKEN: ${{ github.token }}');
    expect(release.indexOf('node scripts/check-release-ci.mjs')).toBeGreaterThan(0);
    expect(release.indexOf('node scripts/check-release-ci.mjs')).toBeLessThan(
      release.indexOf('- name: Build all platforms')
    );
    expect(release).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
  });
});
