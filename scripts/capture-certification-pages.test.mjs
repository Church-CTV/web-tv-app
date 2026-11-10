import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  serializeActivePanel,
  loadCertificationPages,
  requiredPages,
  assertAxeResults,
} from './capture-certification-pages.mjs';
describe('rendered certification evidence', () => {
  it('clones only the active panel, retaining real labels and headings', () => {
    document.documentElement.lang = 'en';
    document.title = 'Production';
    document.body.innerHTML =
      '<section class="screen"><button>Hidden</button></section><section class="screen screen-active"><h1>Search</h1><label for="q">Query</label><input id="q"></section>';
    const html = serializeActivePanel(document);
    expect(html).toContain('<h1>Search</h1>');
    expect(html).toContain('for="q"');
    expect(html).not.toContain('Hidden');
    expect(document.querySelectorAll('.screen')).toHaveLength(2);
  });
  it('fails rather than manufacturing a missing active panel', () => {
    document.body.innerHTML = '<div id="app"></div>';
    expect(() => serializeActivePanel(document)).toThrow(/active panel/);
  });
  it('requires every named platform screen and no placeholders', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cert-pages-'));
    try {
      expect(() => loadCertificationPages(dir)).toThrow(/webos-home/);
      for (const name of requiredPages)
        fs.writeFileSync(path.join(dir, `${name}.html`), '<h1>Real rendered screen</h1>');
      expect(loadCertificationPages(dir).map((p) => p.platform)).toEqual(requiredPages);
      fs.unlinkSync(path.join(dir, 'vizio-error.html'));
      expect(() => loadCertificationPages(dir)).toThrow(/vizio-error/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it('reports real source violations without waiving rules', () => {
    expect(() =>
      assertAxeResults('tizen-search', {
        violations: [
          { id: 'label', nodes: [{ target: ['#query'], failureSummary: 'Missing label' }] },
        ],
      })
    ).toThrow(/tizen-search.*label.*#query.*Missing label/s);
    expect(() =>
      assertAxeResults('webos-home', { violations: [], incomplete: [{ id: 'color-contrast' }] })
    ).toThrow(/incomplete.*color-contrast/);
    expect(() => assertAxeResults('webos-home', { violations: [], incomplete: [] })).not.toThrow();
  });
});
