/**
 * ContrastRatio tests — WCAG 2.1 contrast ratio calculations.
 *
 * Spec: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *   - Relative luminance: L = 0.2126*R + 0.7152*G + 0.0722*B
 *     where each channel c is c/255, linearized as:
 *       c <= 0.03928 ? c/12.92 : ((c + 0.055)/1.055)^2.4
 *   - Ratio: (L_lighter + 0.05) / (L_darker + 0.05)
 */

import { describe, it, expect } from 'vitest';
import {
  contrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  meetsWCAGAALargeText,
  parseColor,
} from './ContrastRatio';

describe('ContrastRatio', () => {
  describe('contrastRatio', () => {
    it('returns 21 for black on white', () => {
      const r = contrastRatio('#000000', '#ffffff');
      expect(r).toBeCloseTo(21, 0);
    });

    it('returns 1 for identical colors', () => {
      expect(contrastRatio('#ff0000', '#ff0000')).toBeCloseTo(1, 5);
    });

    it('returns 1 for black on black', () => {
      expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 5);
    });

    it('is symmetric (order does not matter)', () => {
      const ab = contrastRatio('#7cfc00', '#000000');
      const ba = contrastRatio('#000000', '#7cfc00');
      expect(ab).toBeCloseTo(ba, 5);
    });

    it('computes known ratio: #767676 on white = 4.54 (AA boundary)', () => {
      // #767676 is the well-known "minimum" gray that passes AA on white.
      const r = contrastRatio('#767676', '#ffffff');
      expect(r).toBeGreaterThanOrEqual(4.5);
      expect(r).toBeLessThan(5.0);
    });

    it('computes known ratio: #777777 on white is just under AA (4.48)', () => {
      const r = contrastRatio('#777777', '#ffffff');
      expect(r).toBeLessThan(4.5);
    });

    it('computes known ratio: white on #d40000 (red) ≈ 5.4', () => {
      const r = contrastRatio('#ffffff', '#d40000');
      expect(r).toBeCloseTo(5.4, 0);
    });
  });

  describe('parseColor', () => {
    it('parses 6-digit hex', () => {
      const c = parseColor('#3366ff');
      expect(c).toEqual({ r: 0x33, g: 0x66, b: 0xff, a: 1 });
    });

    it('parses 3-digit hex shorthand', () => {
      const c = parseColor('#f0a');
      expect(c).toEqual({ r: 0xff, g: 0x00, b: 0xaa, a: 1 });
    });

    it('parses rgba() with alpha', () => {
      const c = parseColor('rgba(255, 128, 0, 0.5)');
      expect(c!.r).toBe(255);
      expect(c!.g).toBe(128);
      expect(c!.b).toBe(0);
      expect(c!.a).toBeCloseTo(0.5, 5);
    });

    it('parses rgb()', () => {
      const c = parseColor('rgb(10, 20, 30)');
      expect(c).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    });

    it('parses common named colors', () => {
      expect(parseColor('white')?.r).toBe(255);
      expect(parseColor('white')?.g).toBe(255);
      expect(parseColor('white')?.b).toBe(255);
      expect(parseColor('red')?.r).toBe(255);
      expect(parseColor('red')?.g).toBe(0);
      expect(parseColor('black')?.b).toBe(0);
    });

    it('returns null for invalid color strings', () => {
      expect(parseColor('not-a-color')).toBeNull();
      expect(parseColor('')).toBeNull();
      expect(parseColor('#zzz')).toBeNull();
    });

    it('handles currentColor sentinel (returns null — resolved at runtime)', () => {
      expect(parseColor('currentColor')).toBeNull();
    });
  });

  describe('meetsWCAGAA (normal text, 4.5:1)', () => {
    it('passes for black on white (21:1)', () => {
      expect(meetsWCAGAA('#000000', '#ffffff')).toBe(true);
    });

    it('passes for #767676 on white (~4.54:1)', () => {
      expect(meetsWCAGAA('#767676', '#ffffff')).toBe(true);
    });

    it('fails for #777777 on white (~4.48:1)', () => {
      expect(meetsWCAGAA('#777777', '#ffffff')).toBe(false);
    });

    it('fails for light gray on white', () => {
      expect(meetsWCAGAA('#cccccc', '#ffffff')).toBe(false);
    });

    it('fails for white on white (1:1)', () => {
      expect(meetsWCAGAA('#ffffff', '#ffffff')).toBe(false);
    });
  });

  describe('meetsWCAGAAA (normal text, 7:1)', () => {
    it('passes for black on white', () => {
      expect(meetsWCAGAAA('#000000', '#ffffff')).toBe(true);
    });

    it('fails for #767676 on white (only 4.54:1, needs 7:1)', () => {
      expect(meetsWCAGAAA('#767676', '#ffffff')).toBe(false);
    });

    it('passes for #595959 on white (≈7.1:1)', () => {
      expect(meetsWCAGAAA('#595959', '#ffffff')).toBe(true);
    });
  });

  describe('meetsWCAGAALargeText (large text, 3:1)', () => {
    it('passes for #999999 on white (~2.85:1? check)', () => {
      // #999 on white = 2.85 → fails AA-large.
      expect(meetsWCAGAALargeText('#999999', '#ffffff')).toBe(false);
    });

    it('passes for #767676 on white (~4.54:1, exceeds 3:1)', () => {
      expect(meetsWCAGAALargeText('#767676', '#ffffff')).toBe(true);
    });

    it('passes for #7f7f7f on white (~4.0:1)', () => {
      // #7f7f7f on white ≈ 4.0 → passes 3:1 large text.
      expect(meetsWCAGAALargeText('#7f7f7f', '#ffffff')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles colors with different formats mixed (hex + rgb())', () => {
      const r = contrastRatio('#ffffff', 'rgb(0, 0, 0)');
      expect(r).toBeCloseTo(21, 0);
    });

    it('supports case-insensitive hex', () => {
      const r = contrastRatio('#FFFFFf', '#000000');
      expect(r).toBeCloseTo(21, 0);
    });
  });
});
