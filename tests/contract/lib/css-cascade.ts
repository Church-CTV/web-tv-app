/**
 * The CSS cascade resolver the focus-ring geometry contract depends on.
 *
 * It lives here, separate from the contract, because it is a small CSS engine and a
 * CSS engine is only trustworthy when it has its own tests. `focus-ring-geometry.test.ts`
 * asserts facts about the shipped stylesheets; this file's tests assert facts about CSS
 * itself, including the cases earlier versions of the resolver got wrong:
 *  - a longhand that follows a shorthand in the same block wins for that side, and
 *  - `:is()` / `:not()` / `:where()` do not contribute their own token to specificity,
 *  - `!important` outranks a normal declaration before specificity or order is consulted,
 *  - a `var()` token value is a real declaration and must resolve to a length.
 * A resolver that is wrong about any of those reports a clipped focus ring as cleared.
 */

export type Side = 0 | 1 | 2 | 3;

export const SIDE_LABELS = ['top', 'right', 'bottom', 'left'] as const;

/** Custom-property values, e.g. from `shared/styles/tokens.css`. */
export type Tokens = Record<string, string>;

/** Root font size used to turn `rem` into px: the UA default a TV webview ships with. */
const ROOT_PX = 16;

export type Rule = {
  /** Normalised selector list text, e.g. `.a .b, .c`. */
  selector: string;
  /** Declaration text inside the block. */
  body: string;
  /** Source position among all rules; later wins ties. */
  index: number;
  /** [id, class, element] specificity of the most specific selector in the list. */
  spec: [number, number, number];
  /**
   * Enclosing at-rule preludes, outermost first, e.g. ['media (max-width: 1280px)'].
   * Empty for a rule that applies unconditionally.
   */
  at: string[];
  /**
   * Which stylesheet the rule came from, when the caller passed one. The contract
   * needs it to prove it resolved the whole bundle rather than one file.
   */
  file?: string;
};

export type Candidate = { value: string; rule: Rule };

/**
 * Specificity per CSS Selectors Level 4: `:where()` contributes nothing, and
 * `:is()` / `:not()` / `:has()` contribute the specificity of their most specific
 * argument rather than their own name.
 */
export function specificity(selector: string): [number, number, number] {
  const one = (sel: string): [number, number, number] => {
    let ids = 0;
    let klass = 0;
    let elem = 0;
    // An escape makes the following character part of the identifier it appears in, so
    // `.a\b` is ONE class whose name contains "b", not a class plus the element type
    // `b`. Counting the escaped character as a type inflates the selector and can hand
    // the cascade win to the wrong declaration. Hex escapes (`\31 `) absorb the
    // terminating space the same way a browser does.
    const unescaped = sel.replace(/\\([0-9a-fA-F]{1,6})\s/g, 'X').replace(/\\(.)/g, 'X');
    // Drop :where(...) entirely; it is defined to add zero specificity.
    let s = dropFunctional(unescaped, ':where');
    // Each functional pseudo that inherits its argument's specificity becomes the
    // most specific argument itself, so its parts get counted and its name does not.
    // The substitution is padded with combinators on purpose: the argument is matched
    // alongside the surrounding compound (`a:is(b,c)` names TWO element types), and
    // gluing `a` to `b` without a separator counts the fusion as one type.
    for (const name of [':is', ':not', ':has']) {
      s = replaceFunctional(s, name, (args) => ` ${mostSpecificArg(args)} `);
    }
    ids = (s.match(/#[\w-]+/g) || []).length;
    s = s.replace(/#[\w-]+/g, ' ');
    // Pseudo-elements belong to the type column, and must not be mistaken for a
    // pseudo-class (`::before` is (0,0,1), `:before` is (0,1,0)).
    elem += (s.match(/::[\w-]+/g) || []).length;
    s = s.replace(/::[\w-]+(\([^)]*\))?/g, ' ');
    klass += (s.match(/\[[^\]]*\]/g) || []).length;
    s = s.replace(/\[[^\]]*\]/g, ' ');
    klass += (s.match(/\.[\w-]+/g) || []).length;
    s = s.replace(/\.[\w-]+/g, ' ');
    klass += (s.match(/:[\w-]+(\([^)]*\))?/g) || []).length;
    s = s.replace(/:[\w-]+(\([^)]*\))?/g, ' ');
    elem += (s.match(/[a-z][\w-]*/gi) || []).length;
    return [ids, klass, elem];
  };
  const parts = splitTopLevel(selector, ',');
  let best: [number, number, number] = [0, 0, 0];
  for (const p of parts) {
    const spec = one(p.trim());
    if (cmp(spec, best) > 0) best = spec;
  }
  return best;
}

/**
 * True when a selector names this exact class. `String.includes('.row')` is not
 * enough: `.row-videos` contains `.row`, and borrowing a longer class's declarations
 * would certify clearance the element never receives. Reading one class token at a
 * time gets this right: a token is `.name`, so `#y.x` names the class `x` while
 * `.poster--error` does not name `poster`.
 *
 * Known simplification, stated rather than hidden: a class written with a CSS escape
 * (`.\31 6px`) is not recognised, and a dotted value inside an attribute selector
 * (`[style*="a.b"]`) can read as a class. Neither occurs in these stylesheets, and the
 * contract that would be affected asserts on the shipped files it can see.
 */
export function namesClass(selector: string, className: string): boolean {
  const token = /\.([\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(selector)) !== null) {
    if (m[1] === className) return true;
  }
  return false;
}

/**
 * True when the class is the element the selector actually selects: its rightmost
 * compound. A rule `.row .row-videos { overflow-x: auto }` makes the videos container
 * scroll, not the row, and attributing a declaration to an ancestor that merely
 * appears in the selector is how a clearance can be certified onto the wrong element.
 */
export function namesClassAsSubject(selector: string, className: string): boolean {
  return splitTopLevel(selector, ',').some((part) => {
    const compounds = splitCombinators(part);
    const subject = compounds[compounds.length - 1] ?? part;
    return namesClass(subject, className);
  });
}

/** The compounds of one selector, split at combinators that are not inside parentheses. */
function splitCombinators(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && /\s|[>+~]/.test(ch)) {
      if (current) out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

/** Compare two specificity triples; > 0 means `a` is more specific. */
export function cmp(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** Remove a functional pseudo-selector and everything inside its balanced parens. */
function dropFunctional(selector: string, name: string): string {
  let out = '';
  let i = 0;
  while (i < selector.length) {
    const at = selector.indexOf(name + '(', i);
    if (at === -1) {
      out += selector.slice(i);
      break;
    }
    out += selector.slice(i, at);
    i = skipBalanced(selector, at + name.length);
  }
  return out;
}

/** Replace every `name(...)` with the text produced by `map(args)`. */
function replaceFunctional(selector: string, name: string, map: (args: string) => string): string {
  let out = '';
  let i = 0;
  while (i < selector.length) {
    const at = selector.indexOf(name + '(', i);
    if (at === -1) {
      out += selector.slice(i);
      break;
    }
    out += selector.slice(i, at);
    const end = skipBalanced(selector, at + name.length);
    out += map(selector.slice(at + name.length + 1, end - 1));
    i = end;
  }
  return out;
}

/** Index just past the closing paren of the group that opens at `open` (the "("/"{"). */
function skipBalanced(text: string, open: number): number {
  const close = text[open] === '{' ? '}' : ')';
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === text[open]) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

function mostSpecificArg(args: string): string {
  const parts = splitTopLevel(args, ',');
  let best = '';
  let bestSpec: [number, number, number] = [-1, -1, -1];
  for (const p of parts) {
    const spec = specificity(p.trim());
    if (cmp(spec, bestSpec) > 0) {
      bestSpec = spec;
      best = p.trim();
    }
  }
  return best;
}

/** Split on `sep` at paren depth 0 so `:is(.a, .b)` stays in one piece. */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/**
 * Parse a stylesheet into rules, keeping the at-rule chain each one sits in. A
 * declaration inside `@media` only applies on that viewport, so a resolver that
 * flattens it into the top level can report clearance that a 720p TV never gets.
 */
export function parseRules(css: string, file?: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const stack: string[] = [];
  let i = 0;
  let buffer = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      const head = buffer.trim().replace(/\s+/g, ' ');
      let j = i + 1;
      let depth = 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      const inner = src.slice(i + 1, j - 1);
      if (head.startsWith('@')) {
        // At-rules that contain rule sets keep their prelude on the chain; the
        // declarations of an at-rule that contains only declarations (e.g. @page)
        // are ignored, which no caller here relies on.
        stack.push(atKey(head));
        parseRules(inner, file).forEach((r) => out.push({ ...r, at: [...stack, ...r.at] }));
        stack.pop();
      } else {
        out.push({
          selector: head,
          body: inner.trim(),
          index: out.length,
          spec: specificity(head),
          at: [...stack],
          ...(file ? { file } : {}),
        });
      }
      buffer = '';
      i = j;
      continue;
    }
    if (ch === ';') {
      // A statement at this level (e.g. @import) does not open a block.
      buffer = '';
      i++;
      continue;
    }
    buffer += ch;
    i++;
  }
  // Renumber in source order: nested rules were appended while descending.
  return out.map((r, n) => ({ ...r, index: n }));
}

function atKey(head: string): string {
  const m = head.match(/^@([\w-]+)\s*([^{]*)/);
  return m ? `${m[1]} ${m[2].trim()}`.trim() : head;
}

/**
 * The `@import url(...)` targets of one stylesheet, in document order. A bundler
 * inlines them in that order, so a contract that wants the cascade the browser
 * resolves has to read the same sequence instead of one file.
 */
export function importUrls(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /@import\s+url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1].trim());
  return out;
}

/** Expand a 1-4 value shorthand into [top, right, bottom, left]. */
export function sides(value: string): [string, string, string, string] {
  const p = value.split(/\s+/).filter(Boolean);
  if (p.length === 1) return [p[0], p[0], p[0], p[0]];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  if (p.length === 3) return [p[0], p[1], p[2], p[1]];
  return [p[0], p[1], p[2], p[3]];
}

/** `!important` belongs to the declaration, so strip it before value handling. */
const IMPORTANT_RE = /\s*!\s*important\s*$/i;

/** Every declaration of one property in a body, with its position inside that body. */
function declarations(
  body: string,
  prop: string
): { value: string; at: number; important: boolean }[] {
  const re = new RegExp(`(?:^|;|\\s)${prop}:\\s*([^;]+)`, 'gi');
  const out: { value: string; at: number; important: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const raw = m[1].trim();
    out.push({
      value: raw.replace(IMPORTANT_RE, ''),
      at: m.index,
      important: IMPORTANT_RE.test(raw),
    });
  }
  return out;
}

const INITIAL: Rule = {
  selector: '(initial value)',
  body: '',
  index: -1,
  spec: [0, 0, 0],
  at: [],
};

/**
 * The declaration a browser would apply to one side of one class.
 *
 * Order of authority, per CSS: `!important` declarations outrank normal ones, then
 * specificity, then source order, then declaration order inside the winning block.
 * The last tier is what makes `.x { padding: 14px; padding-top: 0 }` report 0px of top
 * room; the first tier is what makes a `!important` clearance win from a weaker
 * selector. Drop either and this reports a clipped ring as cleared.
 */
export function effectiveSide(
  all: Rule[],
  className: string,
  shorthand: string,
  longhand: string,
  side: Side
): Candidate {
  type Weighted = Candidate & { order: number; important: boolean };
  const candidates: Weighted[] = [];
  for (const rule of all.filter((r) => namesClassAsSubject(r.selector, className))) {
    // `all` resets every property at once, so a reset that wins the cascade over the
    // padding removes the room the padding had given, exactly as a later longhand
    // would. Modelling it as a 0px candidate in the same comparison is what the
    // cascade does: the reset only wins when it is more important, more specific or
    // later, and a declaration written after the reset still wins it back.
    // `all: inherit` is not modelled: no clearance property in these stylesheets
    // inherits usefully, and guessing an inherited length would be a fabricated value.
    for (const d of declarations(rule.body, 'all')) {
      if (!/^\s*(unset|initial|normal|revert|revert-layer)\b/i.test(d.value)) continue;
      candidates.push({
        value: '0px',
        rule,
        order: rule.index * 1e6 + d.at,
        important: d.important,
      });
    }
    for (const d of declarations(rule.body, shorthand)) {
      candidates.push({
        value: sides(d.value)[side],
        rule,
        order: rule.index * 1e6 + d.at,
        important: d.important,
      });
    }
    for (const d of declarations(rule.body, longhand)) {
      candidates.push({
        value: d.value,
        rule,
        order: rule.index * 1e6 + d.at,
        important: d.important,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      Number(b.important) - Number(a.important) ||
      cmp(b.rule.spec, a.rule.spec) ||
      b.order - a.order
  );
  return candidates[0] ?? { value: '0px', rule: INITIAL };
}

/** Read the custom properties declared in `:root` blocks of a stylesheet. */
export function parseTokens(css: string): Tokens {
  const tokens: Tokens = {};
  for (const rule of parseRules(css)) {
    if (!/:root/.test(rule.selector)) continue;
    for (const m of rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
      tokens[m[1]] = m[2].trim();
    }
  }
  return tokens;
}

/**
 * Resolve a length to px, or null when it is not a fixed length. CSS allows a
 * unitless zero, `rem`/`em` resolve against the UA default root size, and a
 * `var()` reference resolves through the shipped token map (one level of fallback
 * is honoured). `calc()` and percentages stay null: claiming a number for them
 * would be inventing clearance.
 */
export function px(value: string, tokens?: Tokens, depth = 0): number | null {
  const v = value.trim().replace(IMPORTANT_RE, '');
  if (depth > 4) return null;
  const varMatch = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/i);
  if (varMatch && tokens) {
    const resolved = tokens[varMatch[1]] ?? varMatch[2];
    return resolved === undefined ? null : px(resolved, tokens, depth + 1);
  }
  if (varMatch) return null;
  const m = v.match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === 'rem' || m[2] === 'em') return n * ROOT_PX;
  return n;
}
