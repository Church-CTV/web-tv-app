/**
 * Screen-visibility contract: an inactive screen must be inert, and every screen
 * container must opt into the mechanism that makes it inert.
 *
 * Why this file exists: navigation on this app does not unmount screens. All
 * `#screen-*` panels stay mounted and `visibility.ts` moves a single
 * `screen-active` class between them, which is also how the app knows where the
 * user is (`getActiveScreenId` reads `.screen.screen-active`). The whole design
 * rests on two invariants, and both have already cost this repo a bug:
 *   - `layout.css` keeps `.screen` at `opacity: 0; pointer-events: none` and gives
 *     the pointer and the stacking order back only on `.screen-active`. When that
 *     was not true, a background `<video>` kept intercepting input (J3d) and a
 *     later-appended screen painted over the focus ring.
 *   - Every panel in `index.html` carries the `screen` class, because
 *     `showScreen()` clears the active flag by querying `.screen`. A panel without
 *     that class is never deactivated: it stays visible under the new screen and
 *     keeps taking pointer events, on a platform whose magic remote sends pointers.
 *
 * Neither invariant is checked by behaviour tests when a new panel is added or a
 * CSS rule is reordered, so both are locked here against the shipped files.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const PLATFORMS = ['webos', 'tizen', 'vizio'] as const;

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

/**
 * Every `id="screen-..."` panel declared in a platform entry document, whatever
 * element carries it. The tag is deliberately not hard-coded to `<div>`: the
 * mechanism is the `id`, and a11y-driven authoring is exactly the kind of change
 * that turns a panel into a `<section>` or `<nav>`. An extractor that only saw
 * `<div>` would silently stop checking the panel instead of failing the contract.
 */
export function screenPanels(html: string): { id: string; classes: string[] }[] {
  const panels: { id: string; classes: string[] }[] = [];
  const tag = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    const attrs = m[2];
    const id = attrs.match(/\bid="([^"]+)"/i)?.[1];
    if (!id || !id.startsWith('screen-') || id === 'screen-container') continue;
    const classes = (attrs.match(/\bclass="([^"]*)"/i)?.[1] ?? '').split(/\s+/).filter(Boolean);
    panels.push({ id, classes });
  }
  return panels;
}

/** The `.screen` and `.screen-active` blocks from the shared layout sheet. */
function screenRules(): { base: string; active: string } {
  const css = read('shared/styles/layout.css');
  const block = (selector: string) => {
    const m = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`, 's'));
    if (!m) throw new Error(`shared/styles/layout.css has no "${selector}" rule`);
    return m[1];
  };
  return { base: block('.screen'), active: block('.screen-active') };
}

describe('screen visibility contract', () => {
  const { base, active } = screenRules();

  it('keeps an inactive screen invisible AND pointer-inert', () => {
    // opacity alone would still let a hidden <video> or button swallow the magic
    // remote's pointer events (defect J3d).
    for (const [prop, value] of [
      ['opacity', /opacity:\s*0\s*[;\s]/],
      ['pointer-events', /pointer-events:\s*none/],
    ] as const) {
      expect(
        base,
        `shared/styles/layout.css: .screen must keep ${prop} 0/none while inactive so a ` +
          'background screen cannot paint over or intercept input from the active one'
      ).toMatch(value);
    }
  });

  it('restores pointer control and stacking only on the active screen', () => {
    expect(active, '.screen-active must restore pointer-events: auto').toMatch(
      /pointer-events:\s*auto/
    );
    expect(active, '.screen-active must raise itself above inactive screens with z-index').toMatch(
      /z-index:\s*\d+/
    );
  });

  for (const platform of PLATFORMS) {
    it(`registers every ${platform} screen panel with the visibility mechanism`, () => {
      const entry = `platforms/${platform}/index.html`;
      expect(existsSync(resolve(ROOT, entry)), `${entry} is missing`).toBe(true);
      const panels = screenPanels(read(entry));
      expect(
        panels.length,
        `${entry}: no #screen-* panels found - did the markup move?`
      ).toBeGreaterThan(1);
      const unregistered = panels.filter((p) => !p.classes.includes('screen'));
      expect(
        unregistered.map((p) => `#${p.id} class="${p.classes.join(' ')}"`),
        `${entry}: these panels are not in the .screen set, so showScreen() can never deactivate ` +
          'them and they stay visible and clickable underneath the active screen: '
      ).toEqual([]);
      const initiallyActive = panels.filter((p) => p.classes.includes('screen-active'));
      expect(
        initiallyActive.map((p) => p.id),
        `${entry}: exactly one panel may start active, since more than one .screen-active element ` +
          'paints two screens at once'
      ).toHaveLength(1);
    });
  }
});
describe('screenPanels extractor: the id is the mechanism, not the tag', () => {
  it('sees a panel authored as a section or a nav', () => {
    const html = `
      <main id="screen-container">
        <section id="screen-home" class="screen screen-active"></section>
        <nav id="screen-search" class="screen"></nav>
        <div id="screen-detail" class="screen"></div>
      </main>`;
    expect(screenPanels(html).map((panel) => panel.id)).toEqual([
      'screen-home',
      'screen-search',
      'screen-detail',
    ]);
  });

  it('still ignores a wrapper id that is not a panel and tags with no id', () => {
    const html = `
      <main id="screen-container" class="app"></main>
      <section class="screen"><div></div></section>
      <div id="splash" class="splash"></div>`;
    expect(screenPanels(html)).toEqual([]);
  });
});
