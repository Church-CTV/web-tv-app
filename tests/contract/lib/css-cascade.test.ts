/**
 * Tests for the CSS cascade resolver itself.
 *
 * Each case here is a fact about CSS, taken from the specification rather than from
 * this repo's stylesheets, and each one is a case the first in-file version of the
 * resolver got wrong. They are separated from the shipped-stylesheet contract so that a
 * resolver bug cannot hide behind a stylesheet that happens not to exercise it.
 */
import { describe, it, expect } from 'vitest';
import {
  cmp,
  effectiveSide,
  namesClass,
  namesClassAsSubject,
  parseRules,
  px,
  sides,
  specificity,
  type Side,
} from './css-cascade';

describe('specificity', () => {
  it('counts a class once', () => {
    expect(specificity('.a')).toEqual([0, 1, 0]);
  });

  it('counts an id', () => {
    expect(specificity('#x .y')).toEqual([1, 1, 0]);
  });

  it('counts the argument of :is(), not the wrapper plus the argument', () => {
    // The legacy resolver returned [0,4,0] here: the name `is` plus `.a`, `.b`, `.c`.
    expect(specificity('.a:is(.b,.c)')).toEqual([0, 2, 0]);
  });

  it('takes the most specific argument of :not()', () => {
    expect(specificity('.a:not(#b)')).toEqual([1, 1, 0]);
    expect(specificity('.a:not(.b)')).toEqual([0, 2, 0]);
  });

  it('gives :where() no specificity at all', () => {
    expect(specificity(':where(.a, #b)')).toEqual([0, 0, 0]);
    expect(specificity('.a:where(#b)')).toEqual([0, 1, 0]);
  });

  it('files a pseudo-element in the type column', () => {
    // The legacy resolver returned [0,2,0]; ::before is (0,1,1).
    expect(specificity('.a::before')).toEqual([0, 1, 1]);
  });

  it('keeps a pseudo-class in the class column', () => {
    expect(specificity('.a:focus-visible')).toEqual([0, 2, 0]);
  });

  it('counts attribute selectors in the class column', () => {
    expect(specificity('.a[data-video-id]')).toEqual([0, 2, 0]);
  });

  it('counts type selectors in the type column', () => {
    expect(specificity('div p')).toEqual([0, 0, 2]);
  });

  it('ranks a selector list by its most specific entry', () => {
    expect(specificity('.a, #b')).toEqual([1, 0, 0]);
  });

  it('orders specificity the way a browser does', () => {
    expect(cmp(specificity('#a'), specificity('.b .c .d'))).toBeGreaterThan(0);
    expect(cmp(specificity('.b .c'), specificity('.b'))).toBeGreaterThan(0);
    expect(cmp(specificity('div'), specificity('.b'))).toBeLessThan(0);
  });
});

describe('parseRules', () => {
  it('keeps the at-rule chain of a nested rule', () => {
    const rules = parseRules('.a { color: red } @media (max-width: 1280px) { .a { color: blue } }');
    expect(rules).toHaveLength(2);
    expect(rules[0].at).toEqual([]);
    expect(rules[1].at).toEqual(['media (max-width: 1280px)']);
  });

  it('keeps a nested chain two levels deep', () => {
    const rules = parseRules('@supports (display: grid) { @media print { .a { padding: 0 } } }');
    expect(rules[0].at).toEqual(['supports (display: grid)', 'media print']);
  });

  it('ignores comments and statement at-rules', () => {
    const rules = parseRules(
      '@import url(x); /* .ignored { padding: 1px } */ .a { padding: 14px }'
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe('.a');
  });

  it('numbers rules in source order', () => {
    const rules = parseRules(
      '.a { padding: 1px } @media (min-width: 1px) { .b { padding: 2px } } .c { padding: 3px }'
    );
    expect(rules.map((r) => r.selector)).toEqual(['.a', '.b', '.c']);
    expect(rules.map((r) => r.index)).toEqual([0, 1, 2]);
  });
});

describe('effectiveSide', () => {
  it('lets a longhand after a shorthand win that side', () => {
    // The legacy resolver returned 14px here, i.e. it reported clearance a browser
    // never paints: `padding-top: 0` clips the ring again.
    const rules = parseRules('.row .scroller { padding: 14px; padding-top: 0 }');
    expect(px(effectiveSide(rules, 'scroller', 'padding', 'padding-top', 0).value)).toBe(0);
    expect(px(effectiveSide(rules, 'scroller', 'padding', 'padding-right', 1).value)).toBe(14);
  });

  it('lets a shorthand after a longhand win back that side', () => {
    const rules = parseRules('.row .scroller { padding-top: 0; padding: 14px }');
    expect(px(effectiveSide(rules, 'scroller', 'padding', 'padding-top', 0).value)).toBe(14);
  });

  it('prefers the more specific rule over the later one', () => {
    const rules = parseRules('.row .scroller { padding: 2px } .scroller { padding: 14px }');
    const winner = effectiveSide(rules, 'scroller', 'padding', 'padding-top', 0);
    expect(px(winner.value)).toBe(2);
    expect(winner.rule.selector).toBe('.row .scroller');
  });

  it('prefers the later rule at equal specificity', () => {
    const rules = parseRules('.scroller { padding: 14px } .row .scroller { padding: 2px }');
    const winner = effectiveSide(rules, 'scroller', 'padding', 'padding-top', 0);
    expect(px(winner.value)).toBe(2);
  });

  it('reports a zero for a side the shorthand zeroes out', () => {
    const rules = parseRules('.row .scroller { padding: 14px 0 }');
    for (const side of [1, 3] as Side[]) {
      expect(px(effectiveSide(rules, 'scroller', 'padding', 'padding-left', side).value)).toBe(0);
    }
  });

  it('returns an explicit initial value when nothing targets the class', () => {
    const rules = parseRules('.other { padding: 14px }');
    const winner = effectiveSide(rules, 'scroller', 'padding', 'padding-top', 0);
    expect(px(winner.value)).toBe(0);
    expect(winner.rule.selector).toBe('(initial value)');
  });

  it('names the rule it picked so a failure can be read', () => {
    const rules = parseRules('.a .scroller { padding: 14px }');
    expect(effectiveSide(rules, 'scroller', 'padding', 'padding-top', 0).rule.selector).toBe(
      '.a .scroller'
    );
  });
});

describe('shorthand expansion and units', () => {
  it('expands one to four values the way CSS does', () => {
    expect(sides('14px')).toEqual(['14px', '14px', '14px', '14px']);
    expect(sides('14px 0')).toEqual(['14px', '0', '14px', '0']);
    expect(sides('1px 2px 3px')).toEqual(['1px', '2px', '3px', '2px']);
    expect(sides('1px 2px 3px 4px')).toEqual(['1px', '2px', '3px', '4px']);
  });

  it('reads the unitless zero CSS allows', () => {
    expect(px('0')).toBe(0);
    expect(px('14px')).toBe(14);
    expect(px('-14px')).toBe(-14);
    expect(px('auto')).toBeNull();
    expect(px('calc(14px + 1px)')).toBeNull();
  });
});

describe('declaration origin and value resolution', () => {
  it('lets an !important declaration beat a more specific normal one', () => {
    // CSS: important author declarations outrank normal ones regardless of
    // specificity, so a clearance written !important on a single-class selector
    // must win over a later two-class `padding-top: 0`.
    const rules = parseRules(`
      .content-grid__row .content-grid__row-videos { padding-top: 0; }
      .content-grid__row-videos { padding-top: 14px !important; }
    `);
    const winner = effectiveSide(rules, 'content-grid__row-videos', 'padding', 'padding-top', 0);
    expect(px(winner.value)).toBe(14);
    expect(winner.rule.selector).toBe('.content-grid__row-videos');
  });

  it('still ranks specificity and order between two !important declarations', () => {
    const rules = parseRules(`
      .content-grid__row-videos { padding-top: 0 !important; }
      .content-grid__row .content-grid__row-videos { padding-top: 14px !important; }
    `);
    const winner = effectiveSide(rules, 'content-grid__row-videos', 'padding', 'padding-top', 0);
    expect(px(winner.value)).toBe(14);
  });

  it('lets an !important shorthand outrank a normal longhand in the same block', () => {
    // Important beats normal before declaration order is ever consulted, so the
    // longhand only wins its side when both declarations share the same weight.
    const rules = parseRules(`
      .content-grid__row-videos { padding: 14px !important; padding-top: 0; }
    `);
    const winner = effectiveSide(rules, 'content-grid__row-videos', 'padding', 'padding-top', 0);
    expect(px(winner.value)).toBe(14);
  });

  it('resolves a var() token to px through the shipped token map', () => {
    // shared/styles/components.css pads the scroller with var(--spacing-sm), so a
    // resolver that cannot resolve the token reports the shared half as unverifiable.
    const tokens = { '--spacing-sm': '0.5rem', '--spacing-lg': '1.5rem' };
    expect(px('var(--spacing-sm)', tokens)).toBe(8);
    expect(px('var(--spacing-lg)', tokens)).toBe(24);
  });

  it('resolves rem against the UA default root size and refuses calc()', () => {
    expect(px('1rem')).toBe(16);
    expect(px('0.875rem')).toBe(14);
    expect(px('calc(14px + 1rem)')).toBeNull();
    expect(px('var(--nope)')).toBeNull();
  });
});
describe('specificity: escapes and functional pseudo-classes', () => {
  it('treats an escaped character as part of the class name, not as a type', () => {
    // `.a\b` is one class selector whose name contains the character "b".
    // Counting the escaped character as the element type `b` inflates specificity
    // and can hand the win to the wrong declaration.
    expect(specificity('.a\\b')).toEqual([0, 1, 0]);
  });

  it('counts every element type named inside :is(), :not() and :has()', () => {
    // The arguments are matched as if the surrounding selector were reproduced for
    // each of them, so `a:is(b,c)` names two element types.
    expect(specificity('a:is(b,c)')).toEqual([0, 0, 2]);
    expect(specificity('a:not(b)')).toEqual([0, 0, 2]);
  });

  it('takes the most specific argument when the arguments differ in class', () => {
    expect(specificity('.a:is(.b, c)')).toEqual([0, 2, 0]);
    expect(specificity('.a:where(.b, c)')).toEqual([0, 1, 0]);
  });
});

describe('effectiveSide: the universal reset', () => {
  it('lets a later `all: unset` remove an earlier padding', () => {
    // `all` resets every property, so a padding that came before it no longer
    // reaches the box. A resolver that only collects the property it is asked
    // about still reports the dead 14px and certifies clearance the browser drops.
    const rules = parseRules('.x { padding: 14px; } .x { all: unset; }');
    const winner = effectiveSide(rules, 'x', 'padding', 'padding-top', 0);
    expect(px(winner.value)).toBe(0);
    expect(winner.rule.selector).toBe('.x');
  });

  it('keeps a padding that comes after the reset', () => {
    const rules = parseRules('.x { all: unset; padding: 14px; }');
    expect(px(effectiveSide(rules, 'x', 'padding', 'padding-top', 0).value)).toBe(14);
  });

  it('lets only a reset at least as specific as the padding remove it', () => {
    // An id-scoped `all: unset` (1,1,0) outranks a two-class padding (0,2,0), so the
    // box really does lose its room. A class-level reset (0,1,0) does not.
    const idReset = parseRules('#y.x { all: unset; } .x.z { padding: 6px; }');
    expect(px(effectiveSide(idReset, 'x', 'padding', 'padding-top', 0).value)).toBe(0);
    const classReset = parseRules('.y.x { all: unset; } .x.z { padding: 6px; }');
    expect(px(effectiveSide(classReset, 'x', 'padding', 'padding-top', 0).value)).toBe(6);
  });

  it('only treats a universal reset as a reset', () => {
    const rules = parseRules('.x { padding: 14px; } .x { color: unset; }');
    expect(px(effectiveSide(rules, 'x', 'padding', 'padding-top', 0).value)).toBe(14);
  });
});

describe('namesClass', () => {
  it("does not borrow a longer class's declarations", () => {
    expect(namesClass('.content-grid__row-videos { padding: 8px }', 'content-grid__row')).toBe(
      false
    );
    expect(
      namesClass('.content-grid__row-videos { padding: 8px }', 'content-grid__row-videos')
    ).toBe(true);
    expect(namesClass('.row .row-videos', 'row')).toBe(true);
    expect(namesClass('.card:hover .poster', 'card')).toBe(true);
    expect(namesClass(':is(.row, .row-videos)', 'row')).toBe(true);
    expect(namesClass('.poster--error', 'poster')).toBe(false);
  });

  it('attributes a declaration to the element the selector selects', () => {
    // `.row .row-videos` styles the videos container, not the row it sits in.
    expect(namesClassAsSubject('.row .row-videos', 'row-videos')).toBe(true);
    expect(namesClassAsSubject('.row .row-videos', 'row')).toBe(false);
    expect(namesClassAsSubject('.card:hover .poster', 'poster')).toBe(true);
    expect(namesClassAsSubject('.card:hover .poster', 'card')).toBe(false);
    expect(namesClassAsSubject(':is(.row, .row-videos)', 'row')).toBe(true);
    expect(namesClassAsSubject('#a > .row + .row-videos ~ .row', 'row')).toBe(true);
  });

  it('resolves the side a browser would paint, not the first rule that mentions the class', () => {
    const rules = parseRules(
      '.a-b { padding: 8px; } .a { padding-top: 2px; } .a-b { padding-top: 30px; }'
    );
    expect(px(effectiveSide(rules, 'a', 'padding', 'padding-top', 0).value)).toBe(2);
  });
});
