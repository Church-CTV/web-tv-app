#!/usr/bin/env node
/**
 * J4c — Test that all GitHub Actions workflow files pin their `uses:`
 * references to immutable SHA revisions rather than mutable tag/branch
 * references.
 *
 * The test scans every YAML file under `.github/workflows/` and fails if
 * any action reference uses a tag (e.g., `@v7`) instead of a full
 * 40-character SHA.
 *
 * Run: npx vitest run scripts/lib/action-pin.test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Extract all action references (`uses: owner/repo@ref`) from a
 * workflow file string.
 *
 * @param {string} content - The workflow file content
 * @returns {string[]} Array of action references (e.g., "actions/checkout@v7")
 */
export function extractActionRefs(content) {
  const refs = [];
  const lines = content.split('\n');
  for (const line of lines) {
    // Match both list items (- uses: ...) and plain steps (uses: ...)
    // Strip surrounding quotes from the value
    const match = line.match(/^\s*(?:-\s*)?uses:\s*(.+)$/);
    if (match && match[1]) {
      let ref = match[1].trim();
      // Remove trailing YAML comment (e.g., # v7.0)
      ref = ref.replace(/\s+#.*$/, '').trim();
      ref = ref.replace(/^["']/, '').replace(/["']$/, '');
      if (ref) refs.push(ref);
    }
  }
  return refs;
}

/**
 * Determine if a reference is a SHA (40-character hex) or a tag/branch.
 *
 * @param {string} ref - The reference part (after @)
 * @returns {boolean} True if it's a full SHA, false if tag/branch
 */
export function isShaRef(ref) {
  return /^[0-9a-f]{40}$/.test(ref);
}

/**
 * Find all unpinned actions in a directory of workflow files.
 *
 * @param {string} dirPath - Path to the directory containing workflow files
 * @returns {string[]} Array of messages describing unpinned actions
 */
export function findUnpinnedActions(dirPath) {
  const issues = [];

  if (!fs.existsSync(dirPath)) {
    return issues;
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
    const refs = extractActionRefs(content);

    for (const ref of refs) {
      const atIdx = ref.indexOf('@');
      if (atIdx === -1) continue;

      const repo = ref.substring(0, atIdx);
      const version = ref.substring(atIdx + 1);

      if (!isShaRef(version)) {
        issues.push(`${file}: ${repo}@${version} (not a SHA)`);
      }
    }
  }

  return issues;
}

describe('action-pin (J4c)', () => {
  describe('extractActionRefs', () => {
    it('extracts unpinned action references from workflow content', () => {
      const content = `
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '20'
`;
      const refs = extractActionRefs(content);
      expect(refs).toContain('actions/checkout@v7');
      expect(refs).toContain('actions/setup-node@v7');
      expect(refs).toHaveLength(2);
    });

    it('extracts pinned action references', () => {
      const content = `
jobs:
  test:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
`;
      const refs = extractActionRefs(content);
      expect(refs).toContain('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1');
    });

    it('handles quoted references', () => {
      const content = `
jobs:
  test:
    steps:
      - uses: "actions/checkout@v7"
`;
      const refs = extractActionRefs(content);
      expect(refs).toContain('actions/checkout@v7');
    });
  });

  describe('isShaRef', () => {
    it('returns true for valid 40-character hex SHAs', () => {
      expect(isShaRef('3d3c42e5aac5ba805825da76410c181273ba90b1')).toBe(true);
      expect(isShaRef('820762786026740c76f36085b0efc47a31fe5020')).toBe(true);
    });

    it('returns false for tags', () => {
      expect(isShaRef('v7')).toBe(false);
      expect(isShaRef('v1.2.3')).toBe(false);
      expect(isShaRef('main')).toBe(false);
    });

    it('returns false for short SHAs', () => {
      expect(isShaRef('3d3c42e5')).toBe(false);
      expect(isShaRef('3d3c42e')).toBe(false);
    });
  });

  describe('findUnpinnedActions', () => {
    it('finds unpinned actions in actual workflow files', () => {
      const workflowsDir = path.join(__dirname, '../../.github/workflows');
      const issues = findUnpinnedActions(workflowsDir);

      // This test will be RED (fail) until all workflow files are pinned
      expect(issues).toEqual([]);
    });
  });
});
