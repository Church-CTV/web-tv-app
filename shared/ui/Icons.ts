/**
 * Inline SVG icons for shipped UI.
 *
 * `shared/tsconfig.json` references this project so the shared error handling can render
 * artwork too; both projects are composite, so the boundary is explicit rather than a
 * relative import that happens to work in Vite.
 *
 * Why this file exists: an icon written as a text codepoint (`⚠`, `\u26A0`) is not a
 * picture - it is a request to whatever font the platform happens to ship. Chromium with
 * Noto Color Emoji paints a filled yellow block; a bare Tizen or webOS font stack paints
 * a thin outline, a monochrome triangle, or a missing-glyph box. The e2e baseline pins
 * exactly one of those renderings, which is how a "passing" suite hid a real per-device
 * difference (CI: 2 052 pixels different on the error screen, three retries running).
 *
 * Every user-visible icon in this app is therefore artwork the build controls: inline SVG
 * (colour inherited from `currentColor`, size controlled by CSS) or a pinned PNG.
 */

/** Legacy `ErrorScreenData.icon` values accepted by `errorIconSvg`. */
const ICON_ALIASES: Record<string, string> = {
  warning: 'warning',
  error: 'warning',
  // The codepoints, written as escapes on purpose: a literal pictograph in shipped
  // source is exactly the font-dependent artwork this file exists to remove (and the
  // ui-glyph contract test rejects it).
  '\u26A0': 'warning',
  '\u26A0\uFE0F': 'warning',
};

/**
 * The warning glyph: an outlined triangle with an exclamation, drawn on a 24x24 grid so
 * CSS can size it freely. It is deliberately aria-hidden - the error title and message
 * carry the meaning, and a screen reader should not announce decoration.
 */
export function warningIconSvg(): string {
  return (
    '<svg class="icon-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" ' +
    'aria-hidden="true" focusable="false" role="presentation">' +
    '<path d="M12 3.6 2.6 20.4h18.8z" />' +
    '<path d="M12 9.2v5.1" />' +
    '<path d="M12 17.3h0.01" />' +
    '</svg>'
  );
}

/**
 * Resolve whatever an older error record calls an "icon" to real artwork. Unknown names
 * fall back to the warning glyph rather than to a font: a wrong icon is a cosmetic
 * problem, a missing glyph on a television is not.
 */
export function errorIconSvg(name?: string): string {
  const key = name === undefined || name === null ? 'warning' : String(name).trim();
  return ICON_ALIASES[key] === 'warning' || key === '' ? warningIconSvg() : warningIconSvg();
}
