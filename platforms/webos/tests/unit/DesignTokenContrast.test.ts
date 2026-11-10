/**
 * Design-Token Contrast Tests — WCAG AA validation of design system.
 *
 * Reads the actual design tokens from shared/styles/tokens.css and
 * validates that every primary text-on-surface pair used in the app
 * meets WCAG 2.1 AA contrast requirements (4.5:1 for normal text).
 *
 * This is a real CI gate: if a design token change breaks contrast,
 * this test fails the build. It is NOT a visual approximation.
 *
 * Pairs tested:
 *   - --color-text-primary on --color-background (main text on page bg)
 *   - --color-text-primary on --color-surface    (text on card/nav bg)
 *   - --color-text-primary on --color-surface-hover (text on hover bg)
 *   - --color-text-secondary on --color-background  (secondary text on bg)
 *   - --color-text-secondary on --color-surface     (secondary text on surface)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { contrastRatio, parseColor } from '@ctv/core';

const TOKENS_PATH = path.resolve(__dirname, '../../../../shared/styles/tokens.css');

function readDesignTokens(): Record<string, string> {
  const css = fs.readFileSync(TOKENS_PATH, 'utf-8');
  const tokens: Record<string, string> = {};
  const tokenRegex = /--([a-z-]+):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)/g;
  let match;
  while ((match = tokenRegex.exec(css)) !== null) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

describe('Design Token Contrast (WCAG 2.1 AA)', () => {
  const tokens = readDesignTokens();

  it('should have color-text-primary token defined', () => {
    expect(tokens['color-text-primary']).toBeTruthy();
  });

  it('should have color-background token defined', () => {
    expect(tokens['color-background']).toBeTruthy();
  });

  it('should have color-surface token defined', () => {
    expect(tokens['color-surface']).toBeTruthy();
  });

  it('should have color-surface-hover token defined', () => {
    expect(tokens['color-surface-hover']).toBeTruthy();
  });

  it('should have color-text-secondary token defined', () => {
    expect(tokens['color-text-secondary']).toBeTruthy();
  });

  describe('primary text contrast (≥4.5:1)', () => {
    it('text-primary on background passes AA', () => {
      const fg = tokens['color-text-primary'];
      const bg = tokens['color-background'];
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `text-primary (${fg}) on background (${bg}) = ${ratio}:1`
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('text-primary on surface passes AA', () => {
      const fg = tokens['color-text-primary'];
      const bg = tokens['color-surface'];
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `text-primary (${fg}) on surface (${bg}) = ${ratio}:1`).toBeGreaterThanOrEqual(
        4.5
      );
    });

    it('text-primary on surface-hover passes AA', () => {
      const fg = tokens['color-text-primary'];
      const bg = tokens['color-surface-hover'];
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `text-primary (${fg}) on surface-hover (${bg}) = ${ratio}:1`
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('secondary text contrast (≥4.5:1)', () => {
    it('text-secondary on background passes AA', () => {
      const fg = tokens['color-text-secondary'];
      const bg = tokens['color-background'];
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `text-secondary (${fg}) on background (${bg}) = ${ratio}:1`
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('text-secondary on surface passes AA', () => {
      const fg = tokens['color-text-secondary'];
      const bg = tokens['color-surface'];
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `text-secondary (${fg}) on surface (${bg}) = ${ratio}:1`
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('button/accent contrast (≥3:1 large text)', () => {
    it('text-primary on accent (button text on button bg) passes AA-large', () => {
      const fg = tokens['color-text-primary'];
      const bg = tokens['color-accent'];
      const ratio = contrastRatio(fg, bg);
      // Buttons are large text (≥18pt / 1.125rem / 700 weight) → 3:1 AA-large applies
      expect(ratio, `text-primary (${fg}) on accent (${bg}) = ${ratio}:1`).toBeGreaterThanOrEqual(
        3
      );
    });
  });

  describe('parseColor integration', () => {
    it('parses design token hex colors correctly', () => {
      const bg = parseColor(tokens['color-background']);
      expect(bg).not.toBeNull();
      // #1A1A2E → r=0x1A, g=0x1A, b=0x2E
      expect(bg!.r).toBe(0x1a);
      expect(bg!.g).toBe(0x1a);
      expect(bg!.b).toBe(0x2e);
    });
  });
});
