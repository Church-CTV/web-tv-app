/**
 * The one place the reproducibility gate turns measurements into a verdict line.
 *
 * Why this is a separate module: the gate's earlier wording printed a POSITIVE result from
 * the ABSENCE of a problem, which reported things that were never measured. An independent
 * adversarial review of head 479b700 caught both instances on 2026-10-27:
 *   - webOS printed `bytes identical across passes` although its byte check is exempt. The
 *     `.ipk` is an `ar` container whose member headers `ares-package` stamps from the wall
 *     clock, so two passes over the same pinned stage hash differently once they straddle a
 *     second - the identity it announced was a timing accident.
 *   - Every platform printed `shipped artifact re-derivable` on a fresh clone where `build/`
 *     held no artifact, so the shipped comparison had been skipped outright.
 * Keeping the wording here means the exact strings a reviewer trusts are covered by a fast
 * unit test (`scripts/tests/repro-report.test.mjs`) instead of only by a 30-minute packaging
 * run that has to be re-run on real hardware to see what the tool printed.
 *
 * The rule this module enforces: a clause may only appear when the comparison behind it ran,
 * and a clause must name its own exemption when it does not cover everything.
 */

const byteClause = (r) => {
  if (r.bytesRequired) {
    return r.bytesSame ? 'bytes identical across passes' : 'bytes differ across passes';
  }
  // Byte-exempt containers still prove the application payload; say which half was proven.
  const payload = r.payloadSame
    ? 'payload identical across passes'
    : 'payload differs across passes';
  const reason = r.whyBytesExempt ? `: ${r.whyBytesExempt}` : '';
  return r.bytesSame
    ? `${payload} · container bytes not byte-pinned${reason}`
    : `${payload} · container bytes differ (not byte-pinned${reason})`;
};

const shippedClause = (r) => {
  if (!r.shippedFound) {
    // No artifact in build/: nothing was compared, so no verdict of any kind is owed.
    return 'shipped comparison skipped (no artifact in build/)';
  }
  // "payload", not "artifact": the shipped comparison walks the extracted entries. The archive
  // bytes of a shipped file are never compared against a rebuild - only the two rebuilds are
  // compared to each other - so the clause must not borrow the strength of the byte wording.
  if (typeof r.shippedDefect !== 'boolean') {
    // The clause used to be chosen by substring-matching the problem wording, so re-phrasing the
    // gate's message could flip this clause to the positive verdict next to its own defect. The
    // verdict now arrives as a field, and a caller that omits it fails here rather than printing
    // a claim nobody measured.
    throw new TypeError(
      'repro-report: a platform with a shipped comparison must carry a shippedDefect boolean'
    );
  }
  return r.shippedDefect ? 'shipped payload NOT re-derivable' : 'shipped payload re-derivable';
};

export function formatPlatform(r) {
  const ok = r.problems.length === 0 && r.restored;
  const parts = [`${r.label} · ${r.entries} entries`, byteClause(r), shippedClause(r)];
  if (r.acceptedDrift?.length) {
    parts.push(`documented exception: ${r.acceptedDrift.join(', ')}`);
  }
  return `  ${ok ? '✓' : '✗'} ${parts.join(' · ')}`;
}

/**
 * The Node major this repo declares in `engines.node` and pins in both workflows.
 *
 * The release job crashed on 2026-10-27 (run 40567897486, exit 1) because the gate used
 * `Set.prototype.intersection`, a Node 22 API, while `release.yaml`, `ci.yml` and
 * `engines.node` all say Node 20. Every local proof had used Node 22, so the assertion that
 * guards a release had never run on the runtime that publishes one. The floor is stated here
 * so the gate can refuse a runtime by name instead of dying halfway through its own report.
 */
export const MIN_NODE_MAJOR = 20;

/**
 * Decide whether a runtime may run the gate, from its version string alone.
 *
 * An unparseable version is unsupported on purpose: a gate that cannot name its runtime cannot
 * say which runtime produced a "reproducible" verdict, and a silent pass would be a claim with
 * no evidence attached.
 */
export function parseRuntime(version) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? ''));
  if (!m) {
    return {
      version: `unrecognised (${String(version)})`,
      major: null,
      supported: false,
      reason: `cannot parse a Node version out of ${JSON.stringify(String(version))}`,
    };
  }
  const major = Number(m[1]);
  return {
    version: `v${m[1]}.${m[2]}.${m[3]}`,
    major,
    supported: major >= MIN_NODE_MAJOR,
    reason:
      major >= MIN_NODE_MAJOR
        ? null
        : `node >= ${MIN_NODE_MAJOR} required (engines.node, pinned by ci.yml and release.yaml)`,
  };
}

/**
 * Read a flag's value from an argv slice without the bare `indexOf` pitfall.
 *
 * `argv[argv.indexOf(name) + 1]` returns `argv[0]` when the flag is absent, so the first
 * unrelated argument silently becomes the flag's value. For `--tizen-flags` that meant a stray
 * argument could be handed to the packager as signing flags.
 */
export function flagValue(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? '' : argv[at + 1] || '';
}

/**
 * Split shipped-vs-rebuilt entry differences into documented drift and real defects.
 *
 * A documented entry is accepted in either direction: comparing an unsigned shipped artifact
 * against a signed rebuild puts the Tizen signature pair on the built side, and comparing a
 * signed shipped artifact against an unsigned rebuild puts it on the shipped side. An entry is
 * named at most once, even if it appears on both sides.
 *
 * Written without `Set.prototype.intersection` on purpose. That method is Node 22+, and this
 * repo runs on Node 20 in CI and in the release job.
 */
export function acceptedDrift({
  extra = [],
  missing = [],
  changed = [],
  acceptedExtraEntries = [],
  acceptedChangedEntries = [],
} = {}) {
  const acceptedSet = new Set(acceptedExtraEntries);
  const acceptedChangedSet = new Set(acceptedChangedEntries);
  const accepted = [];
  const unexpected = [];
  const seen = new Set();
  const add = (bucket, entry) => {
    if (seen.has(entry)) return;
    seen.add(entry);
    bucket.push(entry);
  };
  for (const entry of [...extra, ...missing])
    add(acceptedSet.has(entry) ? accepted : unexpected, entry);
  for (const entry of changed) add(acceptedChangedSet.has(entry) ? accepted : unexpected, entry);
  return { accepted, unexpected };
}

export function formatReport(results) {
  const failed = results.some((r) => r.problems.length > 0 || !r.restored);
  const skipped = results.filter((r) => !r.shippedFound);
  const base = 'every artifact re-packages with identical application bytes from one dist/';
  const summary = skipped.length
    ? `${base} · shipped comparison skipped for ${skipped.map((r) => r.id ?? r.label.toLowerCase()).join(', ')}`
    : `${base} and the shipped payload re-derivable from this checkout`;
  return { lines: results.map(formatPlatform), summary, failed };
}

/**
 * Turn payload manifest entries (`<path>  <sha256>`, two spaces, from the gate's `walk`) into a
 * lookup map.
 *
 * `entry.split('  ')` is the tempting implementation and it is silently wrong: a path holding a
 * double space splits into three parts, the `Map` constructor keeps the first two, and the
 * entry's hash - the value the whole payload comparison reads - disappears. Split at the LAST
 * delimiter instead, so the path keeps its spaces and the hash stays the value.
 */
export function payloadMap(entries) {
  return new Map(
    entries.map((entry) => {
      const at = entry.lastIndexOf('  ');
      if (at === -1) {
        throw new Error(`payload manifest entry has no hash separator: ${JSON.stringify(entry)}`);
      }
      return [entry.slice(0, at), entry.slice(at + 2)];
    })
  );
}
