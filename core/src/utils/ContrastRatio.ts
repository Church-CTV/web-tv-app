/**
 * ContrastRatio — WCAG 2.1 contrast ratio utilities.
 *
 * Pure functions (no DOM dependency) so they run in Node and in any platform
 * runtime. The contrast formula follows:
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * Thresholds:
 *   - Normal text, AA: 4.5:1
 *   - Normal text, AAA: 7:1
 *   - Large text, AA: 3:1
 *
 * Usage:
 *   contrastRatio('#000000', '#ffffff')          // ≈ 21
 *   meetsWCAGAA('#767676', '#ffffff')            // true  (4.54:1)
 *   meetsWCAGAA('#777777', '#ffffff')            // false (4.48:1)
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Named colors commonly used in CSS (sufficient for static stylesheets).
 * Extensible; unknown names return null.
 */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
  maroon: '#800000',
  olive: '#808000',
  lime: '#00ff00',
  teal: '#008080',
  navy: '#000080',
  aqua: '#00ffff',
  fuchsia: '#ff00ff',
  beige: '#f5f5dc',
  brown: '#a52a2a',
  coral: '#ff7f50',
  gold: '#ffd700',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  pink: '#ffc0cb',
  salmon: '#fa8072',
  tomato: '#ff6347',
  indigo: '#4b0082',
  violet: '#ee82ee',
  darkblue: '#00008b',
  darkred: '#8b0000',
  darkgreen: '#006400',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
};

/**
 * Parse a CSS color string into RGBA.
 *
 * Supported formats:
 *   - #rgb
 *   - #rrggbb
 *   - rgb(r, g, b)
 *   - rgba(r, g, b, a)
 *   - common named colors (see NAMED_COLORS)
 *
 * Returns null for unparseable strings, and for runtime-resolved tokens
 * like "currentColor" that depend on inherited CSS state.
 */
export function parseColor(color: string): RGBA | null {
  const value = color.trim().toLowerCase();
  if (!value) return null;

  // Named color.
  const named = NAMED_COLORS[value];
  if (named) return parseHex(named);

  // Hex shorthand #rgb or full #rrggbb (with or without leading #).
  const hexMatch = value.match(/^#?([0-9a-f]{3,6})$/);
  if (hexMatch) {
    return parseHex('#' + hexMatch[1]);
  }

  // rgb() / rgba()
  const rgbMatch = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)$/
  );
  if (rgbMatch) {
    const [, rs, gs, bs, as] = rgbMatch;
    const r = Number(rs);
    const g = Number(gs);
    const b = Number(bs);
    const a = as !== undefined ? Math.min(1, Math.max(0, Number(as))) : 1;
    if (r > 255 || g > 255 || b > 255) return null;
    return { r, g, b, a };
  }

  return null;
}

function parseHex(hex: string): RGBA | null {
  // hex includes leading # here.
  let body = hex.replace(/^#/, '');
  if (body.length === 3) {
    body = body
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (body.length !== 6) return null;
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a: 1 };
}

/**
 * Compute relative luminance per WCAG 2.1.
 * c is a 0..1 linearized channel value.
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Compute the WCAG 2.1 contrast ratio between two CSS color strings.
 *
 * Returns -1 if either color cannot be parsed (callers should treat this
 * as "unknown" rather than a failure).
 */
export function contrastRatio(fg: string, bg: string): number {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return -1;

  const lf = relativeLuminance(f.r, f.g, f.b);
  const lb = relativeLuminance(b.r, b.g, b.b);
  const lighter = Math.max(lf, lb);
  const darker = Math.min(lf, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAGAA(fg: string, bg: string, largeText = false): boolean {
  const r = contrastRatio(fg, bg);
  if (r < 0) return false;
  return r >= (largeText ? 3 : 4.5);
}

export function meetsWCAGAAA(fg: string, bg: string, largeText = false): boolean {
  const r = contrastRatio(fg, bg);
  if (r < 0) return false;
  return r >= (largeText ? 4.5 : 7);
}

export function meetsWCAGAALargeText(fg: string, bg: string): boolean {
  return meetsWCAGAA(fg, bg, true);
}
