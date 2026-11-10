/**
 * Contract test for the alpha parser inside the painted-ring probe.
 *
 * Why this exists: `tests/e2e/ctv/focus-ring.helper.ts` rejects a focus ring whose
 * computed colour is transparent, because a transparent outline still hit-tests and
 * still reports `outline: 3px solid` - the computed-is-not-painted class of defect,
 * one layer deeper. The gate is only as honest as the parser that reads the colour,
 * and webviews are not obliged to serialise a colour the way Chrome does: a Tizen or
 * Vizio webview may report `rgb(255 255 255 / 40%)`, `color(srgb 1 1 1 / 0.4)`,
 * `oklch(...)` or `hwb(...)`. A parser that cannot read those forms reports alpha 1
 * and lets a see-through ring through the gate.
 *
 * Each expectation below is the alpha the browser actually computes for that colour,
 * taken from CSS Color 4, not from what the parser happened to return.
 */
import { describe, it, expect } from 'vitest';
import { expectRingPainted, ringAlpha, type RingProbe } from '../e2e/ctv/focus-ring.helper';

describe('ringAlpha: legacy forms', () => {
  it('reads rgba() alpha in comma syntax', () => {
    expect(ringAlpha('outline 3px solid rgba(255, 255, 255, 0.4)')).toBeCloseTo(0.4, 5);
  });

  it('reads rgba() alpha in space syntax', () => {
    expect(ringAlpha('outline 3px solid rgba(255 255 255 / 0.3)')).toBeCloseTo(0.3, 5);
  });

  it('reads an 8-digit hex alpha channel', () => {
    expect(ringAlpha('outline 3px solid #ffffff80')).toBeCloseTo(0x80 / 0xff, 5);
  });

  it('reads the transparent keyword as zero', () => {
    expect(ringAlpha('outline 3px solid transparent')).toBe(0);
  });

  it('reports an opaque legacy colour as 1', () => {
    expect(ringAlpha('outline 3px solid rgb(255, 255, 255)')).toBe(1);
    expect(ringAlpha('outline 3px solid #ffffff')).toBe(1);
  });
});

describe('ringAlpha: modern colour serialisations a native webview may report', () => {
  it('reads a percentage alpha in the space-separated rgb() form', () => {
    // rgb(255 255 255 / 40%) is 0.4, not opaque: a percentage is a valid alpha.
    expect(ringAlpha('outline 3px solid rgb(255 255 255 / 40%)')).toBeCloseTo(0.4, 5);
  });

  it('reads alpha out of the functional color() notation', () => {
    expect(ringAlpha('outline 3px solid color(srgb 1 1 1 / 0.4)')).toBeCloseTo(0.4, 5);
  });

  it('reads alpha out of oklch()', () => {
    expect(ringAlpha('outline 3px solid oklch(0.9 0.1 50 / 0.2)')).toBeCloseTo(0.2, 5);
  });

  it('reads alpha out of hwb()', () => {
    expect(ringAlpha('outline 3px solid hwb(0 0% 100% / 0.3)')).toBeCloseTo(0.3, 5);
  });

  it('reads alpha out of hsl() in space syntax', () => {
    expect(ringAlpha('outline 3px solid hsl(0 100% 100% / 0.25)')).toBeCloseTo(0.25, 5);
  });

  it('treats an opaque modern colour as 1', () => {
    expect(ringAlpha('outline 3px solid rgb(255 255 255)')).toBe(1);
    expect(ringAlpha('outline 3px solid oklch(0.9 0.1 50)')).toBe(1);
  });

  it('treats a named colour as opaque', () => {
    // getComputedStyle never reports a keyword, but authored strings reach this
    // parser from tests and tooling, and `white` is opaque, not unknown.
    expect(ringAlpha('outline 3px solid white')).toBe(1);
  });

  it('still fails closed on a colour it cannot parse', () => {
    // Unknown serialisation must not pass as opaque: report 0 so the gate fails loudly.
    expect(ringAlpha('outline 3px solid currentColor')).toBe(0);
  });

  it('fails closed on color-mix, whichever way its arguments are written', () => {
    // R6A M1: a softened ring (`color-mix(in srgb, var(--color-focus) 50%, transparent)`)
    // used to fall through to "opaque", so a see-through ring passed the alpha gate.
    // The parser cannot reason about a mix, so it must report 0 and fail the gate.
    expect(ringAlpha('outline 3px solid color-mix(in oklab, red, transparent)')).toBe(0);
    expect(ringAlpha('outline 3px solid color-mix(in srgb, red 50%, transparent)')).toBe(0);
    expect(ringAlpha('outline 3px solid color-mix(in srgb, rgb(0 0 0 /.3), white)')).toBe(0);
  });

  it('parses the bare colour the probe passes when the ring shorthand has no prefix', () => {
    expect(ringAlpha('rgba(255, 255, 255, 0.5)')).toBeCloseTo(0.5, 5);
  });
});

describe('ringAlpha: space-separated forms must not read a channel as alpha', () => {
  // In the slash-less space grammar an alpha exists only as a FOURTH token. Reading the
  // last token unconditionally makes an opaque black (`rgb(0 0 0)`, `rgb(0% 0% 0%)`) or a
  // saturated HSL ring (`hsl(0 100% 50%)`) report a fraction, and the painted-ring gate
  // then fails a ring that is fully visible. Each expectation is the alpha the browser
  // computes for that colour under CSS Color 4.
  it('reports opaque black written without commas as opaque', () => {
    expect(ringAlpha('outline 3px solid rgb(0 0 0)')).toBe(1);
    expect(ringAlpha('outline 3px solid rgb(0% 0% 0%)')).toBe(1);
  });

  it('does not read HSL lightness as alpha', () => {
    expect(ringAlpha('outline 3px solid hsl(0 100% 50%)')).toBe(1);
  });

  it('still reads a genuine fourth-token alpha', () => {
    expect(ringAlpha('outline 3px solid rgb(0 0 0 0.4)')).toBeCloseTo(0.4, 5);
    expect(ringAlpha('outline 3px solid hsl(0 100% 50% 0.25)')).toBeCloseTo(0.25, 5);
  });

  it('keeps the forms it already read correctly', () => {
    expect(ringAlpha('outline 3px solid rgba(0, 0, 0, 0)')).toBe(0);
    expect(ringAlpha('outline 3px solid rgba(0 0 0 / 0)')).toBe(0);
    expect(ringAlpha('outline 3px solid rgb(255 255 255)')).toBe(1);
    expect(ringAlpha('outline 3px solid color(srgb 1 1 1)')).toBe(1);
  });
});
/**
 * A probe result whose four edge bands are carried by the poster layer and report one
 * ring string. Everything but the ring is built to pass, so a failure here can only be
 * about the ring itself.
 */
function probeWithRing(ring: string): RingProbe {
  const edge = {
    name: 'poster',
    x: 100,
    y: 2,
    hitTag: 'IMG',
    hitClass: 'content-card__poster-img',
    inCard: true,
    onPoster: true,
    ring,
  };
  return {
    cardRect: { top: 0, bottom: 124, left: 0, right: 440 },
    edges: [edge, edge, edge, edge],
    clip: { topOverhang: 0, bottomOverhang: 0, scrollerFound: true },
  };
}

describe('expectRingPainted: what the alpha gate actually rejects', () => {
  it('accepts an opaque outline on the poster layer', () => {
    expect(() =>
      expectRingPainted(probeWithRing('outline 3px solid rgb(255, 255, 255)'), 'home row')
    ).not.toThrow();
  });

  it('rejects a ring the probe saw as semi-transparent', () => {
    expect(() =>
      expectRingPainted(probeWithRing('outline 3px solid rgba(255, 255, 255, 0.2)'), 'home row')
    ).toThrow();
  });

  it('rejects a semi-transparent ring expressed in modern syntax', () => {
    // The commit that added the alpha gate claimed it failed on a transparent outline;
    // it only did so for the legacy serialisations Chrome emits. A webview free to
    // report `rgb(255 255 255 / 40%)` handed the same ring a pass.
    expect(() =>
      expectRingPainted(probeWithRing('outline 3px solid rgb(255 255 255 / 40%)'), 'home row')
    ).toThrow();
    expect(() =>
      expectRingPainted(probeWithRing('outline 3px solid color(srgb 1 1 1 / 0.3)'), 'home row')
    ).toThrow();
  });

  it('rejects a ring band that carries no ring', () => {
    expect(() => expectRingPainted(probeWithRing('none'), 'home row')).toThrow();
  });

  it('rejects a probe where focus never landed on a card', () => {
    expect(() => expectRingPainted(null, 'home row')).toThrow();
  });
});
