/**
 * Unit tests for scripts/check-contrast.mjs — WCAG 2.1 AA contrast audit.
 *
 * Run with vitest: npx vitest run scripts/check-contrast.test.mjs
 */
import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  parseTokensCss,
  getContrastPairs,
  auditContrast,
} from './check-contrast.mjs';

describe('hexToRgb', () => {
  it('parses #FFFFFF', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255]);
  });

  it('parses #1A1A2E', () => {
    expect(hexToRgb('#1A1A2E')).toEqual([0x1a, 0x1a, 0x2e]);
  });

  it('parses lowercase hex', () => {
    expect(hexToRgb('#e94560')).toEqual([0xe9, 0x45, 0x60]);
  });
});

describe('relativeLuminance', () => {
  it('white is 1.0', () => {
    const lum = relativeLuminance([255, 255, 255]);
    expect(Math.abs(lum - 1.0)).toBeLessThan(0.01);
  });

  it('black is 0.0', () => {
    const lum = relativeLuminance([0, 0, 0]);
    expect(Math.abs(lum - 0.0)).toBeLessThan(0.01);
  });
});

describe('contrastRatio', () => {
  it('white on black is 21:1', () => {
    const ratio = contrastRatio('#FFFFFF', '#000000');
    expect(Math.abs(ratio - 21)).toBeLessThan(0.1);
  });

  it('is symmetric', () => {
    const ab = contrastRatio('#FFFFFF', '#1A1A2E');
    const ba = contrastRatio('#1A1A2E', '#FFFFFF');
    expect(Math.abs(ab - ba)).toBeLessThan(0.01);
  });

  it('identical colors give 1:1', () => {
    const ratio = contrastRatio('#1A1A2E', '#1A1A2E');
    expect(Math.abs(ratio - 1.0)).toBeLessThan(0.01);
  });
});

describe('parseTokensCss', () => {
  it('extracts color tokens', () => {
    const css =
      ':root { --color-background: #1A1A2E; --color-accent: #E94560; --font-family: sans-serif; }';
    const tokens = parseTokensCss(css);
    expect(tokens['background']).toBe('#1a1a2e');
    expect(tokens['accent']).toBe('#e94560');
    expect(tokens['font-family']).toBeUndefined();
  });

  it('extracts hyphenated token names', () => {
    const css = ':root { --color-text-secondary: #B8B8B8; --color-error-text: #FF7373; }';
    const tokens = parseTokensCss(css);
    expect(tokens['text-secondary']).toBe('#b8b8b8');
    expect(tokens['error-text']).toBe('#ff7373');
  });
});

describe('getContrastPairs', () => {
  it('returns at least 8 pairs', () => {
    const pairs = getContrastPairs();
    expect(pairs.length).toBeGreaterThanOrEqual(8);
  });

  it('gates the token the card ring actually paints with, not just the red focus token', () => {
    // F100 was a focus ring that never painted. The ring on content cards is
    // `--color-card-focus` (the white poster outline), a different token from the
    // red `--color-focus`. If only the red token is in the pair list, the card ring
    // can be dimmed to near-invisibility and every gate still reports PASS.
    const fgs = getContrastPairs().map((p) => p.fg);
    expect(fgs).toContain('focus');
    expect(fgs).toContain('card-focus');
  });

  it('all pairs have required fields', () => {
    const pairs = getContrastPairs();
    for (const p of pairs) {
      expect(p.fg).toBeTruthy();
      expect(p.bg).toBeTruthy();
      expect(p.min).toBeGreaterThanOrEqual(3.0);
      expect(p.min).toBeLessThanOrEqual(4.5);
    }
  });
});

describe('auditContrast', () => {
  it('returns pass/fail for all pairs', () => {
    const tokens = {
      background: '#000000',
      surface: '#111111',
      accent: '#FF0000',
      'accent-hover': '#CC0000',
      error: '#FF4444',
      'error-text': '#FF7373',
      success: '#00FF00',
      'success-text': '#00D85E',
      'text-primary': '#FFFFFF',
      'text-secondary': '#CCCCCC',
      'surface-hover': '#333333',
      focus: '#FF00FF',
      'card-focus': '#FFFFFF',
      black: '#000000',
    };
    const results = auditContrast(tokens);
    expect(results.length).toBe(getContrastPairs().length);
    for (const r of results) {
      expect(r).toHaveProperty('pass');
      expect(r).toHaveProperty('ratio');
    }
  });

  it('compliant production token set all pass', () => {
    const tokens = {
      background: '#1A1A2E',
      surface: '#16213E',
      accent: '#D63450',
      'accent-hover': '#CC2E4A',
      error: '#D93636',
      'error-text': '#FF7373',
      success: '#007A36',
      'success-text': '#00D85E',
      'text-primary': '#FFFFFF',
      'text-secondary': '#B8B8B8',
      'surface-hover': '#0F3460', // must mirror --color-surface-hover in shared/styles/tokens.css
      focus: '#DD4D62', // must mirror --color-focus in shared/styles/tokens.css
      'card-focus': '#FFFFFF', // must mirror --color-card-focus in shared/styles/tokens.css
      black: '#000000',
    };
    const results = auditContrast(tokens);
    const failures = results.filter((r) => !r.pass);
    expect(failures.length).toBe(0);
  });

  it('flags non-compliant accent (too dark for white text)', () => {
    // Original accent #E94560: white-on = 3.83 < 4.5
    const tokens = {
      background: '#1A1A2E',
      surface: '#16213E',
      accent: '#E94560',
      'accent-hover': '#d63d56',
      error: '#FF4444',
      'error-text': '#FF7373',
      success: '#007A36',
      'success-text': '#00D85E',
      'text-primary': '#FFFFFF',
      'text-secondary': '#B8B8B8',
      focus: '#E94560',
      black: '#000000',
    };
    const results = auditContrast(tokens);
    const buttonOnAccent = results.find((r) => r.context === 'button text on accent bg');
    expect(buttonOnAccent).toBeTruthy();
    expect(buttonOnAccent.ratio).toBeLessThan(4.5);
    expect(buttonOnAccent.pass).toBe(false);

    const buttonOnError = results.find((r) => r.context === 'button text on error bg');
    expect(buttonOnError).toBeTruthy();
    expect(buttonOnError.ratio).toBeLessThan(4.5);
    expect(buttonOnError.pass).toBe(false);
  });
});
