#!/usr/bin/env node
/**
 * WEB-015: prove that a published package can be re-derived from the dist/ it came from.
 *
 * Why this file exists: measured on 2026-10-27, every packager was non-deterministic.
 * Two back-to-back passes over an UNCHANGED `dist/` on one host produced three pairs of
 * different artifact hashes - webOS `.ipk` dfa1c19b vs 5b3daa8b, Vizio `.zip` 44efa70c vs
 * 974a6b5e, Tizen `.wgt` 658ee281 vs 17c7890d - because zip and tar copy file mtimes into
 * the container and each pass restamps the staging tree. G9 (release integrity) claims
 * reproducible package contents, and a checksum nobody can re-derive is a claim, not
 * evidence. `scripts/deterministic-stage.sh` fixes the cause for the two archives we
 * create ourselves; this gate keeps the claim from rotting.
 *
 * Three verdicts per platform:
 *   PASS A vs PASS B - the application payload (extracted entry set + per-entry SHA-256)
 *     must always match, and so must the whole-archive bytes for Tizen and Vizio, where
 *     the archiver is ours. webOS is exempt on bytes: `ares-package` stamps its own
 *     `ar`/inner-tar timestamps, ignores `SOURCE_DATE_EPOCH` (verified by setting it on
 *     both passes) and derives `Installed-Size` from filesystem blocks - measured 207756
 *     vs 243670 for byte-identical payloads on two hosts. The payload is what must agree.
 *   SHIPPED vs PASS B - the artifact sitting in `build/` (the one about to be published)
 *     must be re-derivable from the same `dist/` entry for entry, except for entries the
 *     platform documents as accepted. For a signed Tizen build the accepted delta is the
 *     signature pair, verified against the published `v0.1.0` bytes: 19 shipped entries
 *     vs 17 locally rebuilt, differing ONLY by `author-signature.xml` and
 *     `signature1.xml`, every shared entry hashing the same. The Vizio `.zip` matched
 *     outright: 16 entries, identical set and hashes.
 *   RESTORE - whatever was found in `build/` goes back byte-for-byte, so this gate can
 *     run inside the release job without changing the bytes that get published.
 *
 * Toolchain note, stated rather than hidden: `scripts/gen-icons.mjs` writes PNGs through
 * `node:zlib.deflateSync(level 9)`, which is deterministic for a given Node build but NOT
 * across builds - patch-level, on one machine: Node 20.20.2 (the release workflows' major)
 * and 22.23.3 emit `splash.png` `7d4994d1` / 4198 B, which are the published `v0.1.0` bytes,
 * while this host's 22.22.1 emits `899aea56` / 4188 B for art that decodes to the same
 * pixels. That is why `assets/generated/splash.png` is a pinned input the webOS packager
 * stages as-is (WEB-015a): without it, a package built on one Node could never match a
 * release built on another, and this gate's shipped-vs-rebuilt comparison would only be
 * meaningful on the toolchain that produced `build/`. The icons stay generated - they are
 * stored, not deflated, and were already byte-identical across toolchains in the published
 * comparison. See docs/reproducible-packages.md.
 *
 * Usage:
 *   node scripts/check-reproducible-packages.mjs
 *   node scripts/check-reproducible-packages.mjs --tizen-flags "--sign --profile example-profile"
 * Pass the same Tizen flags the packaging step used so the comparison covers the signed
 * artifact the store actually receives. Exit 0 only when every platform clears both checks.
 */
import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moveFile, restoreArtifact } from './lib/fs-move.mjs';
import {
  acceptedDrift,
  flagValue,
  formatReport,
  parseRuntime,
  payloadMap,
} from './lib/repro-report.mjs';
import { runStep } from './lib/run-step.mjs';

// Name the runtime before spending a minute packaging, and refuse a runtime the repo does not
// declare. The release job on 2026-10-27 reached this gate on Node 20 and died with
// `TypeError: Set.intersection is not a function` partway through the report; the crash was the
// API below, but the reason worth printing is the runtime itself.
const runtime = parseRuntime(process.version);
if (!runtime.supported) {
  console.error(
    `[reproducible-packages] FAIL - this gate needs ${runtime.reason}, it was started on ${runtime.version}`
  );
  process.exit(1);
}
import { findArtifact, requireArtifact } from './lib/artifact-lookup.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const tizenFlags = flagValue(argv, '--tizen-flags').trim();

const PLATFORMS = [
  {
    id: 'webos',
    ext: '.ipk',
    label: 'webOS .ipk',
    bytesRequired: false,
    whyBytesExempt:
      'ares-package stamps its own container timestamps and derives Installed-Size from filesystem blocks',
    acceptedExtraEntries: [],
    // control/control is the Debian control file: Installed-Size is `du`-derived, so it
    // tracks the filesystem's block size rather than the payload (measured 207756 vs
    // 243670 for byte-identical payloads). Everything else in the package must match.
    acceptedChangedEntries: ['control/control'],
  },
  {
    id: 'tizen',
    ext: '.wgt',
    label: 'Tizen .wgt',
    // A signed pass runs the vendor signer over the archive; byte equality is only
    // asserted for the unsigned archive, which is entirely ours.
    bytesRequired: !tizenFlags,
    whyBytesExempt: 'the Tizen signer repacks the archive after signing',
    acceptedExtraEntries: tizenFlags ? ['author-signature.xml', 'signature1.xml'] : [],
    acceptedChangedEntries: [],
  },
  {
    id: 'vizio',
    ext: '.zip',
    label: 'Vizio .zip',
    bytesRequired: true,
    whyBytesExempt: '',
    acceptedExtraEntries: [],
    acceptedChangedEntries: [],
  },
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Run one packager pass; move the produced artifact aside so the next pass is a clean one. */
function pack(platform, destDir, n) {
  const buildDir = join(ROOT, 'platforms', platform.id, 'build');
  const script = join(ROOT, 'platforms', platform.id, 'scripts', 'package.sh');
  const args = [script, '--skip-build'];
  if (platform.id === 'tizen' && tizenFlags) args.push(...tizenFlags.split(/\s+/));
  // A packager pass that dies must print the packager's own reason, not just its argv.
  runStep(`pack ${platform.label} pass ${n}`, 'bash', args, {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  const produced = requireArtifact(buildDir, platform.ext);
  // The pass index is not cosmetic. Both passes are packed into the same scratch directory, and
  // without it they resolve to the same destination: pass 2 overwrote pass 1, the two hashes
  // were taken from one file, and the comparison passed before it measured anything.
  const dest = join(destDir, `${platform.id}-pass${n}${platform.ext}`);
  if (existsSync(dest)) {
    throw new Error(
      `pack: ${relative(ROOT, dest)} already holds a packaged artifact - passing over it would ` +
        `make the two-pass comparison compare one file with itself`
    );
  }
  moveFile(produced, dest);
  return dest;
}

/** Extract an archive and hash every entry, sorted by path. */
// Read only the leading bytes: sniffing the container magic must not pull a whole package
// (tens of KB to MB) into memory when seven bytes answer the question.
function headBytes(file, count = 7) {
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(count);
    return buffer.subarray(0, readSync(fd, buffer, 0, count, 0));
  } finally {
    closeSync(fd);
  }
}

function payload(file, ext) {
  const tmp = mkdtempSync(join(tmpdir(), 'repro-payload-'));
  try {
    const root = join(tmp, 'payload');
    mkdirSync(root, { recursive: true });
    if (ext === '.ipk') {
      const head = headBytes(file).toString('latin1');
      if (head === '!<arch>') {
        // Debian-style container written by ares-package. The manifest is the UNPACKED
        // control and data trees: hashing the two inner tarballs instead would inherit the
        // container's own timestamps and report drift that is not application bytes. Each
        // tree is namespaced so a same-named file cannot collide.
        runStep('unpack .ipk ar container', 'ar', ['x', file], { cwd: tmp });
        // Both members are mandatory, and missing one is an error rather than a skip. webOS is
        // byte-exempt, so this unpacked tree is the ONLY A-vs-B signal the gate has: skipping a
        // absent member yields a shorter, or even empty, manifest that compares equal to itself,
        // which would let a container the gate never actually read print a positive verdict.
        for (const [inner, sub] of [
          ['control.tar.gz', 'control'],
          ['data.tar.gz', 'data'],
        ]) {
          const innerPath = join(tmp, inner);
          if (!existsSync(innerPath)) {
            throw new Error(`ar container ${file} has no ${inner} member`);
          }
          const out = join(root, sub);
          mkdirSync(out, { recursive: true });
          runStep(`unpack ${inner} member`, 'tar', ['-xzf', innerPath, '-C', out]);
        }
      } else {
        runStep('unpack .ipk tar container', 'tar', ['-xzf', file, '-C', root]);
      }
    } else {
      runStep('unpack zip container', 'unzip', ['-q', '-o', file, '-d', root]);
    }
    return walk(root);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function walk(root) {
  const entries = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else entries.push(`${relative(root, full)}  ${sha256(readFileSync(full))}`);
    }
  }
  return entries.sort();
}

function check(platform) {
  const buildDir = join(ROOT, 'platforms', platform.id, 'build');
  // Scratch stays inside the repo on purpose. On a CI runner the workspace is on a disk
  // volume while the system temp dir is tmpfs, and a rename across that boundary dies
  // with EXDEV (release rehearsal run 40566120178). One filesystem keeps the atomic move.
  const tmp = mkdtempSync(join(ROOT, '.repro-'));
  let shipped = null;
  let shippedCopy = null;
  try {
    // null is the normal answer for a tree that has not been packaged yet, and for one that was
    // packaged and then cleared: build/ keeps package-meta.json and stage/, so testing for the
    // directory proves nothing about whether the artifact is in it.
    shipped = findArtifact(buildDir, platform.ext);
    if (shipped) {
      shippedCopy = join(tmp, `shipped${platform.ext}`);
      copyFileSync(shipped, shippedCopy);
    }

    const passA = pack(platform, tmp, 1);
    const passB = pack(platform, tmp, 2);

    // Put the shipped artifact back before anything else can read build/, keeping the
    // copy so the shipped-vs-rebuilt comparison still has something to open.
    if (shipped) copyFileSync(shippedCopy, shipped);

    const a = { bytes: sha256(readFileSync(passA)), payload: payload(passA, platform.ext) };
    const b = { bytes: sha256(readFileSync(passB)), payload: payload(passB, platform.ext) };

    const problems = [];
    const notes = [];
    let documented = [];

    const payloadSame = JSON.stringify(a.payload) === JSON.stringify(b.payload);
    if (!payloadSame) {
      const left = payloadMap(a.payload);
      const right = payloadMap(b.payload);
      const drift = [
        ...[...left.keys()].filter((k) => !right.has(k) || right.get(k) !== left.get(k)),
        ...[...right.keys()].filter((k) => !left.has(k)),
      ];
      problems.push(
        `two passes over one dist/ packaged different application bytes ` +
          `(${drift.slice(0, 5).join(', ')})`
      );
    }
    const bytesSame = a.bytes === b.bytes;
    if (!bytesSame && platform.bytesRequired) {
      problems.push(
        `the archive bytes differ between passes (${a.bytes.slice(0, 12)} vs ` +
          `${b.bytes.slice(0, 12)}) even though the payload matches, so re-packaging ` +
          `rewrites the published artifact`
      );
    }
    if (!bytesSame && !platform.bytesRequired) {
      notes.push(`container bytes differ (accepted: ${platform.whyBytesExempt})`);
    }

    // The shipped verdict travels as a boolean. It used to be inferred downstream from the words
    // inside the problem string, so re-phrasing that message would print "shipped payload
    // re-derivable" on the same line as the defect it describes.
    let shippedDefect = false;
    if (shipped) {
      const shippedPayload = payload(shippedCopy, platform.ext);
      const built = payloadMap(b.payload);
      const shippedMap = payloadMap(shippedPayload);
      const extra = [...shippedMap.keys()].filter((k) => !built.has(k));
      const missing = [...built.keys()].filter((k) => !shippedMap.has(k));
      const changed = [...built.keys()].filter(
        (k) => shippedMap.has(k) && shippedMap.get(k) !== built.get(k)
      );
      // Classification lives in the report lib so the both-directions rule and the
      // "documented set only" rule are pinned by a unit test instead of by a packaging run.
      const drift = acceptedDrift({
        extra,
        missing,
        changed,
        acceptedExtraEntries: platform.acceptedExtraEntries,
        acceptedChangedEntries: platform.acceptedChangedEntries,
      });
      if (drift.unexpected.length) {
        shippedDefect = true;
        problems.push(
          `the shipped ${platform.ext} is not re-derivable from this dist/: ` +
            `${drift.unexpected.slice(0, 6).join(', ')}`
        );
      }
      documented = drift.accepted;
    }

    // What build/ holds now decides whether the release job can still publish what it had: a
    // missing artifact is a reported defect, never an exception that hides the report.
    const after = findArtifact(buildDir, platform.ext);

    return {
      id: platform.id,
      label: platform.label,
      entries: b.payload.length,
      bytesSame,
      payloadSame,
      bytesRequired: platform.bytesRequired,
      whyBytesExempt: platform.whyBytesExempt ?? null,
      shippedFound: !!shipped,
      shippedDefect,
      acceptedDrift: documented,
      problems,
      notes,
      restored: !shipped || (after !== null && basename(shipped) === basename(after)),
    };
  } finally {
    // A thrown pass must not cost the developer the artifact they were holding. `pack()` runs a
    // packager that removes and rewrites this path in place, so on the failure path it can hold the
    // packager's partial output; restoring only an empty `build/` kept that partial file and let the
    // backup die with the scratch directory.
    restoreArtifact({ shipped, shippedCopy });
    rmSync(tmp, { recursive: true, force: true });
  }
}

const results = PLATFORMS.map(check);

// The wording lives in scripts/lib/repro-report.mjs so the exact verdict strings a reviewer
// reads are pinned by a fast unit test rather than only by a packaging run.
const report = formatReport(results);

console.log('--- REPRODUCIBLE PACKAGE CHECK (WEB-015) ---');
// Every clause below is a claim about bytes; the runtime that observed them is part of the
// evidence, so the report names the node that produced it instead of leaving it to a log line.
console.log(`  runtime: node ${runtime.version}`);
results.forEach((r, i) => {
  console.log(report.lines[i]);
  for (const note of r.notes) console.log(`      · ${note}`);
  for (const problem of r.problems) console.error(`      DEFECT: ${problem}`);
  if (!r.restored) {
    console.error('      DEFECT: build/ no longer holds the artifact found here before the check');
  }
});

if (report.failed) {
  console.error('[reproducible-packages] FAIL - see the defects above');
  process.exit(1);
}
console.log(`[reproducible-packages] PASS - ${report.summary}`);
