/**
 * The error screen's warning icon must be drawn, not typed.
 *
 * CI proved the difference: identical markup rendered as a thin white triangle on one
 * machine and as a colour-emoji triangle on another, because `⚠` is a codepoint the
 * installed *font* resolves. On televisions the font stack is whoever shipped the
 * firmware, so an emoji icon is a different picture per model group - and Samsung's
 * reviewers see exactly one of them. The nav already draws its icons as SVG; the error
 * screen has no business being worse than the nav.
 */

import { describe, it, expect } from 'vitest';
import { getErrorScreen, renderErrorScreen } from '../../ErrorHandling';
import { warningIconSvg } from '../../ui/Icons';

// Emoji and pictographic ranges that a font may substitute artwork for.
// Variation selector and ZWJ are matched separately: ESLint (rightly) refuses
// combining marks inside a character class.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\uFE0F|\u200D/u;
const TYPES = ['network', 'feed', 'ui', 'stream', 'video', 'auth', 'generic'] as const;

describe('error screen icon is drawn artwork, not a font codepoint', () => {
  it('the warning glyph is an inline SVG, decorative and non-focusable', () => {
    const svg = warningIconSvg();
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox');
    expect(svg).toContain('<path');
    expect(svg).toMatch(/aria-hidden="true"/);
    expect(svg).toMatch(/focusable="false"/);
  });

  for (const type of TYPES) {
    it(`the ${type} error screen carries the SVG and no font-resolved emoji`, () => {
      const html = renderErrorScreen(getErrorScreen(type));
      expect(html).toContain('error-screen__icon');
      expect(html).toContain('<svg');
      expect(html, `${type}: an emoji icon changes shape with the installed font`).not.toMatch(
        EMOJI
      );
      expect(html).toMatch(/class="error-screen__icon"[^>]*aria-hidden="true"/);
    });
  }

  it('the meaning stays in text, so the picture can be decorative', () => {
    const html = renderErrorScreen(getErrorScreen('network'));
    expect(html).toMatch(/role="alert"/);
    expect(html).toMatch(/<h2 class="error-screen__title">/);
    expect(html).toMatch(/<p class="error-screen__message">/);
  });
});
