import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const rehearsal = readFileSync('.github/workflows/release.yaml', 'utf8');
describe('portable source validation, not store certification', () => {
  it('runs the complete suite before building diagnostic packages', () => {
    expect(ci).toContain('run: npm test');
    expect(ci.indexOf('run: npm test')).toBeLessThan(ci.indexOf('run: npm run build'));
    expect(ci).not.toMatch(/test:focused|--exclude|continue-on-error/);
  });
  it('checks reproducibility before checksums in both workflows', () => {
    for (const workflow of [ci, rehearsal]) {
      const gate = workflow.indexOf('node scripts/check-reproducible-packages.mjs');
      expect(gate).toBeGreaterThan(workflow.indexOf('run: npm run build'));
      expect(workflow.indexOf('run: sha256sum')).toBeGreaterThan(gate);
      expect(workflow).not.toContain('continue-on-error');
    }
  });
  it('never treats a diagnostic workflow as store certification or deployment', () => {
    for (const workflow of [ci, rehearsal]) {
      expect(workflow).toContain('contents: read');
      expect(workflow).toContain('runs-on: ubuntu-latest');
      expect(workflow).not.toMatch(/secrets\.|contents: write|self-hosted|--sign|--upload|gh release|action-gh-release/);
    }
    expect(rehearsal).toContain('no publication');
    expect(rehearsal).toContain('on: workflow_dispatch');
  });
});
