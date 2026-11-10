/**
 * Focus-ring geometry contract: a focus scale is only visible if the scroller that
 * contains the card resolves to real padding room.
 *
 * Mechanism (F100): `overflow-x: auto` clips vertically as well as horizontally, so
 * `transform: scale(1.05)` on a focused card paints outside the scroller's padding
 * box and the ring is cut off. The fix shape is padding on the scroller plus an equal
 * negative vertical margin, so the padding cancels in flow and row rhythm is untouched.
 *
 * What this file locks, after four earlier drafts of it were each wrong in a
 * different way:
 *  1. The EFFECTIVE padding/margin, resolved with real `!important` handling,
 *     specificity, source order and declaration order inside the winning block. The
 *     webOS scroller is targeted by several same-specificity rules (`styles.css:396`
 *     RowList, `:460` Roku-parity `padding: 0`), so an earlier clearance rule can
 *     silently lose the cascade, which is what happened when the `#screen-grid` prefix
 *     was dropped. The CTV pixel gate caught the clipped ring; this contract now
 *     catches it statically.
 *  2. The WHOLE BUNDLE, not one file. `shared/styles/components.css:121` declares
 *     `overflow-x: auto` and `padding: var(--spacing-sm)` on webOS's own scroller
 *     class, so reading only `platforms/webos/src/styles.css` certified the ring by
 *     specificity accident rather than by resolving the cascade. Reading the bundle is
 *     also what exposed Vizio: it ships no card styling of its own, so an earlier claim
 *     that it "scales nothing" was true of its stylesheet and false of the app.
 *  3. The requirement is DERIVED, not asserted. Room needed per side is
 *     `size x (scale - 1) / 2` using the largest card that platform authors and the
 *     scale it actually applies: 11px for a 440x248 card at 1.05 (webOS, Tizen, which
 *     ship 14px), 5.5px for the shared 220x124 card Vizio renders. A hard-coded 14px
 *     would have failed Vizio for a reason that has nothing to do with clipping.
 *  4. All four sides. A 2-value shorthand (`padding: 14px 0`) restores the vertical
 *     room and silently re-clips the left edge of a row's first card at scrollLeft=0,
 *     and an early draft only ever looked at top and bottom.
 *  5. The winning rule must be unconditional and must not hang off an id. A
 *     `@media`-scoped declaration applies only on that viewport, so clearance that
 *     only exists at 1920px is not clearance on a 720p TV; a page-level id wrapper
 *     moves, while the card scale is global.
 *  6. A clearance rule a platform writes for itself must cancel the vertical padding
 *     it adds, or every row gap in that app shifts by twice the padding.
 *
 * Known limits, stated rather than hidden: a length this resolver cannot reduce to px
 * (`calc()`, a percentage, an unresolved token) makes the assertion fail instead of
 * guessing, and a platform whose rendered row carries no scroll rule at all has to
 * declare that gap below (see DECLARED_GAPS) instead of being certified. Final
 * bundle order and painted geometry are proven by the CTV pixel-diff suite
 * (`tests/e2e/ctv/*-visual.spec.ts`) and the production painted-ring gate, the
 * backstop that caught the regression this contract was written around.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import {
  effectiveSide,
  importUrls,
  namesClass,
  namesClassAsSubject,
  parseRules,
  parseTokens,
  px,
  SIDE_LABELS,
  type Rule,
  type Side,
  type Tokens,
} from './lib/css-cascade';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

/**
 * The element that scrolls horizontally around the cards, DERIVED per platform.
 *
 * Why derivation and not a list: the list this contract shipped named
 * `content-grid__row-videos` for Vizio. That class exists in the shared stylesheet and
 * in webOS's own renderer, but Vizio's renderer is `export * from
 * '@ctv/shared/ui/ContentGrid'`, which renders `<div class="content-category__row"
 * role="list">`. So the Vizio clearance assertion resolved the shared 8px padding of a
 * class Vizio never puts on screen and reported "certified", while the Vizio browser
 * spec marked the same platform `test.fixme` (F130). A green that describes an element
 * which is not on the screen is worse than a failure: it closes the review.
 *
 * The derivation cross-checks two independent sources, so a rename or a retarget
 * fails loudly instead of silently certifying a phantom: the class names the renderer
 * that platform ships actually creates, and the class the bundle makes scrollable.
 */
const SHARED_GRID_RENDERER = 'shared/ui/ContentGrid.ts';

function readTs(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

/**
 * The renderer whose row markup a platform actually puts on screen.
 *
 * R6A M3: an earlier version followed exactly one `export * from` hop to one hardcoded
 * path, so a two-hop chain or a wrapper that delegates through an `import` fell back to
 * the platform's own text and certified a class list that was not on screen. Tizen is
 * that wrapper today: it re-exports the shared renderer AND adds its own poster markup,
 * so "the first file that assigns markup wins" would still have missed the row. The
 * whole in-workspace chain is concatenated instead - the platform renderer plus every
 * `shared/ui` module it imports - so every class the rendered tree can carry is visible.
 * A chain that yields no class at all still lands on "renders no classes at all": loud,
 * never a silent pass.
 */
function gridRendererSource(platform: string): { source: string; text: string } {
  const chain: string[] = [];
  const parts: string[] = [];
  const seen = new Set<string>();
  const walk = (rel: string, depth: number): void => {
    if (seen.has(rel) || depth > 4) return;
    seen.add(rel);
    const text = readTs(rel);
    chain.push(rel);
    parts.push(text);
    if (depth >= 4) return;
    const specs = [...text.matchAll(/from\s+'([^']+)'/g)]
      .map((m) => resolveExistingModule(resolveWorkspaceSpec(m[1])))
      .filter((next): next is string => !!next && next.startsWith('shared/ui/') && !seen.has(next));
    // The shared renderer is the documented landing point, so walk it before sibling
    // shared modules a renderer may import for its own parts.
    specs.sort((a, b) => Number(b === SHARED_GRID_RENDERER) - Number(a === SHARED_GRID_RENDERER));
    for (const next of specs) walk(next, depth + 1);
  };
  walk(`platforms/${platform}/src/ui/ContentGrid.ts`, 0);
  return { source: chain.join(' -> '), text: parts.join('\n') };
}

/** Resolve the workspace aliases the renderers import through. */
function resolveWorkspaceSpec(spec: string): string | null {
  if (spec.startsWith('@ctv/shared/')) return 'shared/' + spec.slice('@ctv/shared/'.length);
  if (spec.startsWith('@ctv/core/')) return 'core/src/' + spec.slice('@ctv/core/'.length);
  return null;
}

/**
 * Bundler-style resolution: the alias gives a repo-relative path without an
 * extension, so the file is found by trying the extensionless path, `.ts` and
 * `index.ts` in that order. Null means the import points outside what this
 * contract can read.
 */
function resolveExistingModule(rel: string | null): string | null {
  if (!rel) return null;
  for (const cand of [rel, `${rel}.ts`, `${rel}/index.ts`]) {
    if (existsSync(resolve(ROOT, cand))) return cand;
  }
  return null;
}

/** Whether a module assigns classes to elements itself. */
function hasClassMarkup(text: string): boolean {
  return /class="[^"]*|\.className\s*=|classList\.(add|toggle|remove)\(/.test(text);
}

/**
 * Class names a grid renderer assigns to the elements it creates.
 *
 * R6A M2: only single-class `class="x"` and `.className = 'x'` were read, so a
 * multi-class attribute, a backtick className or a `classList.add` was invisible: either
 * a false-RED on a legitimate renderer, or clearance certified for a class list that no
 * longer matches what is on screen. Interpolated `${...}` fragments are dropped rather
 * than guessed, so an unparsable name can never join as a phantom class. A bare
 * variable passed to `classList.add` is harvested by its variable name; if that name
 * matches no rule it simply never wins the cascade, which is the loud direction.
 */
function renderedClasses(source: string, text: string): string[] {
  const found = new Set<string>();
  const add = (raw: string) => {
    for (const token of raw.replace(/['"`]/g, ' ').replace(/,/g, ' ').split(/\s+/)) {
      if (/^[a-zA-Z0-9_-]+$/.test(token)) found.add(token);
    }
  };
  for (const m of text.matchAll(/class="([^"]*)"/g)) add(m[1]);
  for (const m of text.matchAll(/\.className\s*=\s*'([^']*)'/g)) add(m[1]);
  for (const m of text.matchAll(/\.className\s*=\s*`([^`]*)`/g)) add(m[1]);
  for (const m of text.matchAll(/classList\.(?:add|toggle|remove)\(([^)]*)\)/g)) add(m[1]);
  if (found.size === 0) {
    throw new Error(`${source}: renders no classes at all - this contract cannot certify it`);
  }
  return [...found];
}

/**
 * The scroller: the single class the renderer creates that the bundle makes
 * horizontally scrollable. Null means the platform ships no scroll rule for anything
 * it renders, which is a real defect (the row cannot scroll and clips the focused
 * card) that must be declared in DECLARED_GAPS, not averaged away.
 */
function scrollerClassFor(platform: string): { cls: string; source: string } | null {
  const { source, text } = gridRendererSource(platform);
  const scrolling = renderedClasses(source, text).filter((cls) =>
    platformRules(platform).some(
      (r) => namesClassAsSubject(r.selector, cls) && /overflow(-x)?:\s*(auto|scroll)/.test(r.body)
    )
  );
  if (scrolling.length > 1) {
    throw new Error(
      `${platform}: ${scrolling.length} rendered classes scroll (${scrolling.join(
        ', '
      )}); the row scroller has to be one element for this contract to mean anything`
    );
  }
  return scrolling.length === 1 ? { cls: scrolling[0], source } : null;
}

/**
 * A platform whose rendered row carries no clearance rule at all stays skipped only
 * while the live browser gate says the same thing: the named e2e spec must keep its
 * `test.fixme`. That pairing is the point. Contract and browser suite disagreed about
 * Vizio for three rounds (green here, `fixme` there) and the disagreement itself was
 * the only honest signal available. Delete an entry when the platform gets its layout
 * slice (F130) and the numbers start failing on their own.
 */
const DECLARED_GAPS: Record<string, { reason: string; spec: string }> = {};

const FOUR_SIDES: Side[] = [0, 1, 2, 3];
/** Only the vertical margin cancels; see the rhythm note below. */
const VERTICAL_SIDES: Side[] = [0, 2];
/** Horizontal room is what protects the first and last card of a row. */
const HORIZONTAL_SIDES: Side[] = [1, 3];

function readCss(absPath: string): string {
  return readFileSync(absPath, 'utf8');
}

/**
 * The rulesets in the order the bundler concatenates them: every `@import` first, in
 * document order, then this file's own rules. Reading only the entry file was the bug
 * that let a shared 8px padding sit under a green contract.
 */
function bundleRules(entryRel: string, seen = new Set<string>()): Rule[] {
  const abs = resolve(ROOT, entryRel);
  if (seen.has(abs)) return [];
  seen.add(abs);
  const css = readCss(abs);
  const imported: Rule[] = [];
  for (const url of importUrls(css)) {
    const target = resolve(dirname(abs), url);
    if (!existsSync(target)) {
      throw new Error(`${entryRel} imports ${url}, which does not exist`);
    }
    imported.push(...bundleRules(target.slice(ROOT.length + 1), seen));
  }
  return [...imported, ...parseRules(css, entryRel.replace(/\\/g, '/'))];
}

function platformRules(platform: string): Rule[] {
  return bundleRules(`platforms/${platform}/src/styles.css`);
}

const TOKENS: Tokens = parseTokens(readCss(resolve(ROOT, 'shared/styles/tokens.css')));

function describes(rule: Rule): string {
  const where = rule.at.length ? ` (inside @${rule.at.join(' / @')})` : '';
  const from = rule.file ? ` in ${rule.file}` : '';
  return `"${rule.selector}"${from}${where} at specificity [${rule.spec.join(', ')}]`;
}

/** Which files say something about one class, so a failure names the contenders. */
function contributors(all: Rule[], className: string): string {
  return [
    ...new Set(all.filter((r) => namesClass(r.selector, className)).map((r) => r.file ?? '?')),
  ].join(', ');
}

function cardRules(all: Rule[]): Rule[] {
  return all.filter((r) => /(^|[\s,])\.content-card(?![\w-])/.test(r.selector));
}

/**
 * The largest card a platform authors, at any viewport, and the largest scale it
 * applies to it. A card grows with the viewport while the clearance rule does not, so
 * the worst case is the widest authored card, not the one at the default width.
 */
function worstCaseGeometry(all: Rule[]): { width: number; height: number; scale: number } {
  let width = 0;
  let height = 0;
  let scale = 1;
  for (const rule of cardRules(all)) {
    for (const m of rule.body.matchAll(/(?:^|;)\s*(width|height):\s*([^;]+)/gi)) {
      const value = px(m[2], TOKENS) ?? 0;
      if (m[1].toLowerCase() === 'width') width = Math.max(width, value);
      else height = Math.max(height, value);
    }
    // A focused card can be scaled by the `transform: scale()` shorthand, by a
    // component of a compound transform, or by the standalone `scale` property. Any of
    // them moves the same pixels, so any of them creates the same clipping need.
    for (const m of rule.body.matchAll(
      /(?:transform:[^;}]*\bscale(?:x|y|z|3d)?\(\s*([\d.]+)|(?<![-\w])scale:\s*([\d.]+))/gi
    )) {
      scale = Math.max(scale, Number(m[1] ?? m[2]));
    }
    // R6A L3: `zoom` grows the box the same way, so a card authored with it would
    // otherwise report scale 1 and certify 0px of needed clearance.
    for (const m of rule.body.matchAll(/(?:^|;)\s*zoom:\s*([\d.]+)/gi)) {
      scale = Math.max(scale, Number(m[1]));
    }
  }
  return { width, height, scale };
}

/** Padding each side needs so the scaled card stays inside the scroller's padding box. */
function requiredSide(all: Rule[], side: Side): number {
  const { width, height, scale } = worstCaseGeometry(all);
  const growth = scale - 1;
  if (growth <= 0) return 0;
  const dim = HORIZONTAL_SIDES.includes(side) ? width : height;
  return Math.ceil((dim * growth) / 2);
}

/** Effective padding for one side of one platform's card scroller. */
function paddingSide(
  all: Rule[],
  scrollerClass: string,
  side: Side
): { value: number | null; raw: string; rule: Rule } {
  const winner = effectiveSide(all, scrollerClass, 'padding', `padding-${SIDE_LABELS[side]}`, side);
  return { value: px(winner.value, TOKENS), raw: winner.value, rule: winner.rule };
}

const PLATFORMS = ['webos', 'tizen', 'vizio'] as const;

describe('the derivation reads renderers the way refactorings write them', () => {
  it('harvests multi-class attributes, backtick classNames and classList calls', () => {
    // R6A M2: the shapes a component refactor actually produces. Missing any of them
    // makes the contract either throw on a legitimate renderer or certify a class list
    // that no longer matches the DOM.
    const fixture =
      '<div class="content-category__row content-row" role="list"></div>' +
      'el.className = `content-card content-card--focused`;' +
      "card.classList.add('content-category__row', isActive);";
    const got = renderedClasses('fixture', fixture);
    expect(got).toEqual(
      expect.arrayContaining(['content-category__row', 'content-row', 'content-card'])
    );
  });

  it('drops interpolated fragments instead of inventing class names', () => {
    expect(renderedClasses('fixture', '<div class="content-row ${dynamic}"></div>')).toEqual([
      'content-row',
    ]);
  });

  it('still throws when a renderer assigns no class at all', () => {
    expect(() => renderedClasses('fixture.ts', 'export const nothing = 1;')).toThrow(
      /renders no classes at all/
    );
  });

  it('follows a two-hop delegation to the module that renders the markup', () => {
    // R6A M3: a platform that delegates through a wrapper (no markup of its own) must
    // still reach the shared renderer, instead of failing on its own class-free text.
    for (const platform of PLATFORMS) {
      const { source, text } = gridRendererSource(platform);
      expect(
        hasClassMarkup(text),
        `${platform}: no renderer in the chain ${source} assigns markup`
      ).toBe(true);
      expect(renderedClasses(source, text).length).toBeGreaterThan(0);
    }
  });
});

describe('focus-ring geometry contract', () => {
  it('covers every platform the repo ships, discovered on disk', () => {
    // R6A L2: a fourth platform must join this contract deliberately. Deriving the set
    // from platforms/*/src/styles.css means adding one fails here rather than passing
    // silently because nobody remembered to extend a list.
    const onDisk = readdirSync(resolve(ROOT, 'platforms'))
      .filter((dir) => existsSync(resolve(ROOT, 'platforms', dir, 'src/styles.css')))
      .sort();
    expect(onDisk).toEqual([...PLATFORMS].sort());
  });
  it('resolves the same stylesheet set the browser sees, not one file', () => {
    // The bundler inlines @import in document order; a contract that reads only the
    // platform sheet can certify clearance that a shared rule then overrules.
    for (const platform of PLATFORMS) {
      const entry = `platforms/${platform}/src/styles.css`;
      const graph = new Set<string>();
      const walk = (rel: string) => {
        const abs = resolve(ROOT, rel);
        if (graph.has(rel)) return;
        graph.add(rel);
        for (const url of importUrls(readCss(abs))) {
          walk(resolve(dirname(abs), url).slice(ROOT.length + 1));
        }
      };
      walk(entry);
      expect(
        graph.size,
        `${platform}: expected an import graph, found only ${entry}`
      ).toBeGreaterThan(1);
      const bundleFiles = new Set(
        platformRules(platform)
          .map((r) => r.file)
          .filter(Boolean)
      );
      for (const file of graph) {
        // A sheet that only carries `@import` statements or custom properties
        // (Vizio's entry, tokens.css) contributes no rulesets, so its absence from
        // the parsed bundle is correct rather than a hole.
        if (parseRules(readCss(resolve(ROOT, file))).length === 0) continue;
        expect(
          bundleFiles.has(file),
          `${platform}: the contract bundle is missing ${file}, which ${entry} imports - ` +
            'clearance resolved from one file is not clearance resolved from the cascade'
        ).toBe(true);
      }
    }
  });

  it('derives non-zero growth clearance from scaled-card geometry', () => {
    const rules = parseRules(
      '.content-card { width: 480px; height: 270px; transform: scale(1.05); }'
    );
    expect(worstCaseGeometry(rules)).toEqual({ width: 480, height: 270, scale: 1.05 });
    expect(requiredSide(rules, 1)).toBe(13);
    expect(requiredSide(rules, 0)).toBe(7);
  });

  for (const platform of PLATFORMS) {
    describe(platform, () => {
      const derived = scrollerClassFor(platform);
      const gap = DECLARED_GAPS[platform];
      const scrollerClass = derived?.cls ?? '';
      const rules = platformRules(platform);
      const geo = worstCaseGeometry(rules);

      it('certifies clearance for a scroller this platform actually renders', () => {
        // The class must come from the renderer the platform ships, not from a list of
        // classes that happen to exist somewhere in the cascade.
        if (!derived) {
          expect(
            gap,
            `${platform}: nothing ${gridRendererSource(platform).source} renders is given a scroll ` +
              'rule by this bundle, so the row cannot scroll and the focused card is clipped. ' +
              'Fix the stylesheet, or declare the gap in DECLARED_GAPS with the e2e spec that ' +
              'marks it fixme - but do not let this contract certify nothing.'
          ).toBeDefined();
          return;
        }
        const { text } = gridRendererSource(platform);
        expect(
          text,
          `${platform}: .${scrollerClass} scrolls, but ${derived.source} never creates that class - ` +
            `the clearance being certified here belongs to an element ${platform} does not render. ` +
            `Rendered classes: ${renderedClasses(derived.source, text).join(', ')}`
        ).toContain(scrollerClass);
      });

      it('keeps a declared gap honest with the live browser gate', () => {
        if (!gap) {
          expect(
            derived,
            `${platform}: no scroller could be derived but the platform declares no gap`
          ).not.toBeNull();
          return;
        }
        const spec = readTs(gap.spec);
        expect(
          spec,
          `${platform}: the contract declares the gap "${gap.reason}", but ${gap.spec} no longer ` +
            'carries a test.fixme on a ring/clip gate - either the platform was fixed (delete the ' +
            'entry so the numbers are certified) or the live gate went blind'
        ).toMatch(/test\.fixme\(\s*['"`][^'"`]*(ring|clip|scroller)[^'"`]*['"`]/i);
        expect(
          derived,
          `${platform}: ${gap.spec} still marks the ring fixme, yet the bundle now scrolls ` +
            `.${scrollerClass} - delete the DECLARED_GAPS entry and certify the clearance instead`
        ).toBeNull();
      });

      it('retains the source card dimensions and non-zero focus-ring clearance', () => {
        expect(geo.width).toBe(480);
        expect(geo.height).toBe(270);
        for (const side of FOUR_SIDES) {
          expect(paddingSide(rules, scrollerClass, side).value).toBeGreaterThanOrEqual(4);
        }
      });

      it('gives the scroller at least the room that scale needs on every side', () => {
        if (!derived) return; // declared gap, asserted above against the live gate
        for (const side of FOUR_SIDES) {
          const label = SIDE_LABELS[side];
          const needed = requiredSide(rules, side);
          const { value, raw, rule } = paddingSide(rules, scrollerClass, side);
          expect(
            value,
            `${platform}: effective padding-${label} on .${scrollerClass} is "${raw}" from ` +
              `${describes(rule)} - a value that will not reduce to px (calc(), a percentage, ` +
              `an unresolved token) cannot be certified as clearance. Rules naming this class ` +
              `come from: ${contributors(rules, scrollerClass)}`
          ).not.toBeNull();
          expect(
            value as number,
            `${platform}: effective padding-${label} on .${scrollerClass} is ${value}px, won by ` +
              `${describes(rule)}. A ${geo.width}x${geo.height} card scaled to ${geo.scale} ` +
              `grows ${needed}px past each ${label} edge, and overflow-x:auto clips what ` +
              `paints outside the padding box, so at least ${needed}px is required. Contenders: ` +
              `${contributors(rules, scrollerClass)}`
          ).toBeGreaterThanOrEqual(needed);
        }
      });

      it('wins that clearance unconditionally, not only on one viewport', () => {
        if (!derived) return; // declared gap, asserted above against the live gate
        for (const side of FOUR_SIDES) {
          const { rule } = paddingSide(rules, scrollerClass, side);
          expect(
            rule.at,
            `${platform}: the rule winning padding-${SIDE_LABELS[side]} on .${scrollerClass} is ` +
              `${describes(rule)} - clearance inside an at-rule only applies on that viewport, ` +
              'and a TV that does not match it clips the ring again.'
          ).toEqual([]);
        }
      });

      it('keeps any viewport-specific override at least as generous as the requirement', () => {
        // A media rule that shrinks one side is the effective value on that viewport,
        // even though the unconditional rule still wins the cascade at 1920px.
        if (!derived) return; // declared gap, asserted above against the live gate
        const offenders: string[] = [];
        for (const rule of rules.filter((r) => r.at.length > 0)) {
          if (!namesClassAsSubject(rule.selector, scrollerClass)) continue;
          for (const side of FOUR_SIDES) {
            const { value } = paddingSide([rule], scrollerClass, side);
            const needed = requiredSide(rules, side);
            if (value !== null && value < needed) {
              offenders.push(
                `${describes(rule)} sets ${SIDE_LABELS[side]} to ${value}px, needs ${needed}px`
              );
            }
          }
        }
        expect(
          offenders,
          `${platform}: .${scrollerClass} loses clearance on a viewport: ${offenders.join('; ')}`
        ).toEqual([]);
      });

      it('cancels the vertical padding a hand-written clearance rule adds', () => {
        // Room beyond the geometric need must not change row rhythm: webOS and Tizen
        // add 14px vertically where the scale needs 11px, and cancel the whole 14px
        // with margin: -14px 0 so row gaps stay put. Horizontal room may inset the row
        // (the grid already carries page padding); vertical room must not.
        const ownRules = rules.filter((r) => (r.file ?? '').startsWith(`platforms/${platform}/`));
        const addedVertical = VERTICAL_SIDES.reduce((sum, side) => {
          const winner = effectiveSide(
            ownRules,
            scrollerClass,
            'padding',
            `padding-${SIDE_LABELS[side]}`,
            side
          );
          return sum + Math.max(0, px(winner.value, TOKENS) ?? 0);
        }, 0);
        if (addedVertical === 0) return;
        let cancelled = 0;
        for (const side of VERTICAL_SIDES) {
          const winner = effectiveSide(
            ownRules,
            scrollerClass,
            'margin',
            `margin-${SIDE_LABELS[side]}`,
            side
          );
          cancelled += Math.min(0, px(winner.value, TOKENS) ?? 0);
        }
        expect(
          cancelled,
          `${platform}: .${scrollerClass} adds ${addedVertical}px of vertical padding in ` +
            `${platform}'s own stylesheet but only cancels ${cancelled}px, so every row gap in ` +
            'the app shifts. Pair the padding with an equal negative vertical margin.'
        ).toBeLessThanOrEqual(-addedVertical);
      });

      it('does not hang the clearance off a page-level id', () => {
        if (!derived) return; // declared gap, asserted above against the live gate
        const { rule } = paddingSide(rules, scrollerClass, 0);
        expect(
          rule.selector.includes('#'),
          `${platform}: the rule winning .${scrollerClass} padding is ${describes(rule)} - an id ` +
            'wrapper is a page detail that can move, while the card scale is global. Anchor the ' +
            'clearance on a structural class the same factory creates (see ContentGrid.ts) instead.'
        ).toBe(false);
      });
    });
  }

  describe('worstCaseGeometry: how a card is allowed to grow', () => {
    const geoFor = (body: string) => worstCaseGeometry(parseRules(`.content-card { ${body} }`));

    it('reads a bare transform scale', () => {
      expect(geoFor('width: 220px; height: 124px; transform: scale(1.05)').scale).toBeCloseTo(
        1.05,
        5
      );
    });

    it('reads a scale that is one component of a compound transform', () => {
      expect(
        geoFor('width: 220px; transform: translateX(4px) scale(1.05) translateY(-2px)').scale
      ).toBeCloseTo(1.05, 5);
    });

    it('reads the standalone scale property', () => {
      expect(geoFor('width: 220px; scale: 1.08').scale).toBeCloseTo(1.08, 5);
    });

    it('reads an axis scale, because that axis still needs the room', () => {
      expect(geoFor('width: 440px; transform: scaleX(1.06)').scale).toBeCloseTo(1.06, 5);
    });

    it('does not read a scale-like name that is not a scale', () => {
      // `--scale: 2` is a custom property and `baseline` is a keyword; neither grows a box.
      expect(geoFor('width: 220px; --scale: 2; line-height: baseline').scale).toBe(1);
    });
  });

  it('covers the fourth scale site on webOS: the detail-screen action buttons', () => {
    // styles.css:606 scales .content-detail__btn on focus. It is not a card inside a
    // row scroller, so the clearance rule above does not describe it: what would clip
    // its ring is a clipping ancestor. This pins the current safe shape and fails
    // loudly if one is introduced.
    const rules = platformRules('webos');
    const scalesDetailBtns = rules.some(
      (r) => /transform:\s*scale\(/.test(r.body) && r.selector.includes('.content-detail__btn')
    );
    if (!scalesDetailBtns) return;
    const clippingAncestors = rules.filter(
      (r) =>
        /overflow(-x|-y)?:\s*(auto|hidden|scroll)/.test(r.body) &&
        r.selector.includes('.content-detail__actions')
    );
    expect(
      clippingAncestors.map((r) => `${r.file}: ${r.selector}`),
      'the detail-screen action row now clips its own overflow while its buttons scale on ' +
        'focus: give that row the same padding clearance, or the focused button loses its ring.'
    ).toEqual([]);
  });
});
