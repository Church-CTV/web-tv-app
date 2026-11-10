/**
 * Report contract (WEB-015): the line a reviewer reads must say exactly what the gate
 * measured, and nothing more.
 *
 * Why this file exists: an independent adversarial review of head 479b700 found two places
 * where the printed verdict claimed more than the run proved.
 *   - webOS printed `bytes identical across passes` although its byte check is exempt. The
 *     `.ipk` is an `ar` container and `ares-package` stamps member headers with wall-clock
 *     time: two runs over the same pinned stage 1.6 s apart hashed differently
 *     (`a7f1275a` vs `2a8c8023`). The "identical" the line reported was a race inside one
 *     wall-clock second, not a guarantee.
 *   - Every platform printed `shipped artifact re-derivable` even when no artifact was in
 *     `build/` and the shipped comparison never ran. A fresh clone plus `npm run repro`
 *     printed the claim, printed `shipped comparison skipped` two lines below it, and ended
 *     `PASS - ... and the shipped bytes are re-derivable` with exit 0.
 * Both are the same mistake: a verdict derived from the ABSENCE of a problem instead of from
 * the comparison that was actually performed.
 */
import { describe, expect, it } from 'vitest';
import { flagValue, formatReport, payloadMap } from '../lib/repro-report.mjs';

const base = {
  problems: [],
  notes: [],
  shippedDefect: false,
  restored: true,
  entries: 22,
  payloadSame: true,
  bytesSame: true,
};
const tizen = {
  ...base,
  label: 'Tizen',
  ext: '.wgt',
  bytesRequired: true,
  whyBytesExempt: null,
  shippedFound: true,
  acceptedDrift: ['author-signature.xml', 'signature1.xml'],
};
const webos = {
  ...base,
  label: 'webOS',
  ext: '.ipk',
  bytesRequired: false,
  whyBytesExempt: 'ares-package stamps ar member headers with wall-clock time',
  shippedFound: true,
  acceptedDrift: ['control/control'],
};
const vizio = {
  ...base,
  label: 'Vizio',
  ext: '.zip',
  bytesRequired: true,
  whyBytesExempt: null,
  shippedFound: true,
  acceptedDrift: [],
};

const line = (r) => formatReport([r]).lines[0];

describe('reproducibility report wording', () => {
  it('claims byte identity only where bytes are actually required', () => {
    const t = line(tizen);
    expect(t).toContain('bytes identical across passes');
    expect(t).toContain('shipped payload re-derivable');

    const w = line(webos);
    expect(
      w,
      'a byte-exempt container whose headers carry wall-clock time cannot claim byte identity'
    ).not.toContain('bytes identical');
    expect(w).toContain('payload identical across passes');
    expect(w).toContain('container bytes not byte-pinned');
    expect(w, 'the exemption line must state the cause, not just wave at an exemption').toContain(
      'wall-clock'
    );
  });

  it('keeps the payload claim when an exempt container drifts', () => {
    const w = line({ ...webos, bytesSame: false });
    expect(w).toContain('payload identical across passes');
    expect(w, 'drift in the container must still be visible on the summary line').toContain(
      'container bytes differ'
    );
  });

  it('reports a skipped shipped comparison instead of asserting re-derivability', () => {
    const v = line({ ...vizio, shippedFound: false });
    expect(v).toContain('shipped comparison skipped');
    expect(
      v,
      'a comparison that never ran cannot report a result, positive or negative'
    ).not.toContain('re-derivable');
  });

  it('keeps the check mark when only the shipped comparison was skipped', () => {
    // The clause above pins the WORDING of a skip but not the MARK, and the mark is the part a
    // reader scans. The mark belongs to the pass-vs-pass comparison, which did run; the skip is
    // named in the same line, so a check mark here makes no claim about a shipped artifact.
    // Pinned both ways on purpose: a later edit must not turn an honest skip into a failure, and
    // must not keep the check mark while deleting the clause that explains it.
    const v = line({ ...vizio, shippedFound: false });
    expect(v, 'the comparison that ran passed, so the line may not read as a failure').toMatch(
      /^ {2}✓ Vizio/
    );
    expect(v, 'a check mark without the skip clause would overstate what was measured').toContain(
      'shipped comparison skipped'
    );
  });

  it('names the accepted drift it is standing behind', () => {
    const w = line(webos);
    expect(w).toContain('documented exception: control/control');
    expect(
      line(vizio),
      'a platform with no accepted drift must not print an exception clause'
    ).not.toContain('documented exception');
  });

  it('summarises only the comparisons that ran', () => {
    const allRan = formatReport([webos, tizen, vizio]);
    expect(allRan.summary).toContain('shipped payload re-derivable');
    expect(
      allRan.summary,
      'webOS bytes are not pinned, so the summary may not claim byte identity for every artifact'
    ).not.toMatch(/shipped bytes are re-derivable/);

    const skipped = formatReport([webos, tizen, { ...vizio, shippedFound: false }]);
    expect(
      skipped.summary,
      'one skipped comparison is enough to make a blanket re-derivability claim false'
    ).not.toContain('shipped payload re-derivable');
    expect(skipped.summary).toContain('shipped comparison skipped for vizio');
  });

  it('says so when a byte-required platform drifts', () => {
    // Reviewer finding F1: only the positive half of the byte clause was pinned, so a renderer
    // regression to "always identical" would have kept a green suite while printing
    // "bytes identical across passes" over an archive whose two passes differ. This is the exact
    // defect the gate exists to catch, so its wording is pinned from both sides.
    const v = {
      ...vizio,
      bytesSame: false,
      problems: ['the archive bytes differ between passes (aaaabbbb vs ccccdddd)'],
    };
    const l = line(v);
    expect(l).toContain('bytes differ across passes');
    expect(l, 'a drifting archive may not carry a check mark').toMatch(/^ {2}✗ Vizio/);
  });

  it('says so when a byte-exempt platform drifts in its payload', () => {
    // Reviewer finding F2: no test ever set payloadSame to false. For an exempt platform the
    // payload comparison is the ONLY pass-vs-pass signal, so an unpinned "differs" branch is the
    // one that could quietly keep claiming identity while the application bytes move.
    const w = {
      ...webos,
      payloadSame: false,
      problems: ['two passes over one dist/ packaged different application bytes (index.html)'],
    };
    const l = line(w);
    expect(l).toContain('payload differs across passes');
    expect(l, 'a payload difference may not be smoothed into an identical claim').toContain('✗');
  });

  it('names skipped platforms by id when the caller provides one', () => {
    // Reviewer finding F3: the summary read `r.id`, which check() never returned, so the
    // lowercased-label fallback was the only path ever taken and the field was decorative.
    const s = formatReport([
      { ...tizen, id: 'tizen', shippedFound: false },
      { ...webos, id: 'webos' },
      { ...vizio, id: 'vizio' },
    ]).summary;
    expect(s).toContain('shipped comparison skipped for tizen');
    expect(s).not.toContain('tizen .wgt');
  });

  it('fails when a problem or a missing restore is present', () => {
    expect(formatReport([webos, tizen, vizio]).failed).toBe(false);
    expect(formatReport([{ ...tizen, problems: ['x'] }, webos, vizio]).failed).toBe(true);
    expect(formatReport([{ ...vizio, restored: false }, webos, tizen]).failed).toBe(true);
  });

  it('never prints a positive verdict next to a defect for the same platform', () => {
    const r = {
      ...webos,
      shippedDefect: true,
      problems: ['the shipped .ipk is not re-derivable from this dist/: x'],
    };
    const l = line(r);
    expect(l).toContain('NOT re-derivable');
    expect(l).not.toMatch(/✓ webOS/);
  });

  it('picks the shipped clause from the flag, not from the wording of the problem', () => {
    // The gate owns that message and is free to re-word it. The report must still print the
    // negative clause, which is the promise substring-matching could not keep.
    const rephrased = line({
      ...webos,
      shippedDefect: true,
      problems: ['the shipped artifact differs from this dist/ for unrelated reasons'],
    });
    expect(rephrased).toContain('shipped payload NOT re-derivable');
    const positive = line({ ...webos, shippedDefect: false, problems: [] });
    expect(positive).toContain('shipped payload re-derivable');
    expect(positive).not.toContain('NOT re-derivable');
  });

  it('refuses a shipped comparison that carries no verdict', () => {
    // An omitted flag used to fall through to the positive clause. The formatter now refuses to
    // print a claim the gate never made.
    const { shippedDefect, ...withoutFlag } = webos;
    expect(() => line(withoutFlag)).toThrow(/shippedDefect boolean/);
  });
});

/**
 * Flag parsing (WEB-015 adversarial review, LOW). The gate used `argv[argv.indexOf(name) + 1]`,
 * which returns `argv[0]` when the flag is absent, so a stray argument became the Tizen signing
 * flags handed to the packager.
 */
describe('flagValue', () => {
  it('returns the value that follows the flag', () => {
    expect(flagValue(['--tizen-flags', '--sign --profile example-profile'], '--tizen-flags')).toBe(
      '--sign --profile example-profile'
    );
  });

  it('returns empty when the flag is absent, and never borrows an unrelated argument', () => {
    expect(flagValue(['--verbose'], '--tizen-flags')).toBe('');
    expect(flagValue([], '--tizen-flags')).toBe('');
  });

  it('returns empty when the flag is the last argument', () => {
    expect(flagValue(['--other', '--tizen-flags'], '--tizen-flags')).toBe('');
  });
});

describe('payloadMap', () => {
  const H = 'a'.repeat(64);
  const K = 'b'.repeat(64);

  it('maps ordinary entries to path and hash', () => {
    const m = payloadMap([`a.txt  ${H}`, `dir/b.txt  ${K}`]);
    expect([...m.entries()]).toEqual([
      ['a.txt', H],
      ['dir/b.txt', K],
    ]);
  });

  it('keeps the hash when the path itself contains a double space', () => {
    // `entry.split('  ')` here yields three parts and the Map keeps the first two, so the hash
    // - the value every payload comparison reads - silently disappears.
    const m = payloadMap([`assets/two  spaces.png  ${H}`]);
    expect([...m.entries()]).toEqual([['assets/two  spaces.png', H]]);
  });

  it('fails closed on an entry with no separator instead of mapping a hashless key', () => {
    expect(() => payloadMap(['no-separator.txt'])).toThrow(/no hash separator/);
  });
});
