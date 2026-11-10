/**
 * Reproducibility contract (WEB-015): the release page publishes SHA-256 hashes, so the
 * bytes behind them must be re-derivable, and the gate that proves it must stay wired.
 *
 * Why this file exists: until 2026-10-27 nothing asserted it, and every packager was in
 * fact non-deterministic - two passes over an UNCHANGED `dist/` produced different
 * artifacts (webOS `dfa1c19b`→`5b3daa8b`, Tizen `658ee281`→`17c7890d`, Vizio
 * `44efa70c`→`974a6b5e`) because zip and tar copy staging mtimes into the container and
 * each pass re-generates the staging tree. A fix that nothing watches is a fix that
 * regresses, so this file pins the three things the claim rests on:
 *   - every packager pins its staging tree BEFORE it archives (pinning afterwards is a
 *     no-op, since the container has already been written);
 *   - the release job runs the reproducibility gate before it hashes the artifacts;
 *   - the accepted differences are written down, not just coded.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

/**
 * Index of `needle`, failing loudly when it is absent. Every caller here feeds the result into
 * `Math.max`, a slice bound or an ordering comparison, and a bare `indexOf` returns -1 for a
 * renamed or deleted step. -1 then keeps those comparisons true over a window that reads nothing,
 * so the test reports a pass on a contract that is no longer present in the file.
 */
function mustFind(source: string, needle: string, what: string): number {
  const at = source.indexOf(needle);
  expect(
    at,
    `${what}: ${JSON.stringify(needle)} is absent, and an ordering or window assertion built on ` +
      '-1 passes without reading anything'
  ).toBeGreaterThan(-1);
  return at;
}

const PLATFORMS = [
  {
    id: 'webos',
    // The store artifact comes from the vendor CLI; the tar path is the CI/diagnostic
    // fallback. Markers are the invocations themselves, not mentions in comments.
    archiveMarkers: ['ares-package "$STAGE_DIR"', 'tar --sort=name'],
  },
  { id: 'tizen', archiveMarkers: ['zip -X -r'] },
  { id: 'vizio', archiveMarkers: ['zip -X -rq'] },
] as const;

describe('reproducible package contract (WEB-015)', () => {
  it('ships the staging pin and the gate', () => {
    for (const rel of [
      'scripts/deterministic-stage.sh',
      'scripts/check-reproducible-packages.mjs',
    ]) {
      expect(existsSync(resolve(ROOT, rel)), `${rel} is missing`).toBe(true);
    }
  });

  for (const platform of PLATFORMS) {
    it(`pins ${platform.id}'s staging tree before anything is archived`, () => {
      const script = read(`platforms/${platform.id}/scripts/package.sh`);
      const pin = script.indexOf('deterministic-stage.sh');
      expect(
        pin,
        `platforms/${platform.id}/scripts/package.sh never pins the staging tree, so a ` +
          'rebuild restamps every file and the container bytes move on their own'
      ).toBeGreaterThan(-1);

      const archived = platform.archiveMarkers
        .map((m) => script.indexOf(m))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b)[0];
      expect(archived, `${platform.id}: no archive command found in its packager`).toBeGreaterThan(
        -1
      );
      expect(
        pin,
        `${platform.id} pins mtimes AFTER archiving, which changes nothing: the container was ` +
          'already written with the old stamps'
      ).toBeLessThan(archived);
    });
  }

  it('gates reproducibility before the release hashes the artifacts', () => {
    const yaml = read('.github/workflows/release.yaml');
    const gate = mustFind(
      yaml,
      '- name: Assert reproducible package contents',
      'release.yaml reproducibility step'
    );
    const checksums = mustFind(
      yaml,
      '- name: Generate SHA-256 checksums',
      'release.yaml checksum step'
    );
    expect(
      gate,
      'the reproducibility step must run BEFORE checksums.txt is generated: checksums have to ' +
        'hash the files the gate just re-derived, not files that came before it'
    ).toBeLessThan(checksums);
    const step = yaml.slice(gate, checksums);
    expect(step, 'the reproducibility step must run the gate script').toContain(
      'check-reproducible-packages.mjs'
    );
    expect(
      step,
      'the reproducibility step must re-sign Tizen with the release profile, or it compares an ' +
        'unsigned rebuild against the signed artifact the store receives'
    ).toContain('--tizen-flags');
  });

  it('compares two genuinely different artifacts, not one file twice', () => {
    // The headline assertion was vacuous from the day it landed (d30ddd0): pack() named its
    // scratch destination `${platform.id}-pass${ext}` with no pass index, so both passes wrote
    // the same path, the second move overwrote the first, and the comparison hashed one file
    // twice. `payloadSame` and `bytesSame` were therefore TRUE before any packaging result was
    // read, and every run printed "bytes identical across passes". A gate that cannot fail is
    // not a gate, so both halves are pinned: a distinct destination per pass, and a refusal to
    // write over an artifact that already exists (the collision guard is what makes a future
    // regression loud instead of silent).
    const gate = read('scripts/check-reproducible-packages.mjs');
    expect(
      gate,
      'each packaging pass must land on its own scratch path, or the second pass overwrites ' +
        'the first and the two-pass comparison compares a file with itself'
    ).toMatch(/-pass\$\{n\}/);
    expect(gate, 'the two passes must be taken with different pass indices').toMatch(
      /pack\(platform, tmp, 1\)[\s\S]{0,200}pack\(platform, tmp, 2\)/
    );
    expect(
      gate,
      'a scratch collision must abort the run: silently overwriting pass 1 is what made the ' +
        'comparison vacuous'
    ).toMatch(/existsSync\(dest\)/);
  });

  it('never lets the gate fail open in either workflow', () => {
    // The release rehearsal failed on its first run, and the reflex fix for a red gate is to
    // soften it. Both workflows publish bytes the gate vetted, and no step after it re-derives
    // anything, so `continue-on-error: true` or an `if:` on this one step would publish
    // unvetted artifacts with a green job. Pinned so softening it is a deliberate edit.
    for (const rel of ['.github/workflows/release.yaml', '.github/workflows/ci.yml']) {
      const yaml = read(rel);
      const gate = mustFind(
        yaml,
        '- name: Assert reproducible package contents',
        `${rel} reproducibility step`
      );
      // Pin the end of the window as well as its start. A reformat that drops the step's `run:`
      // line collapses the slice below to an empty string, and both assertions then pass without
      // reading a single line of the step.
      const runAt = mustFind(
        yaml.slice(gate),
        '\n        run:',
        `${rel} reproducibility step command block`
      );
      const step = yaml.slice(gate, gate + runAt);
      expect(step, `${rel}: the gate step may not be allowed to fail`).not.toContain(
        'continue-on-error'
      );
      expect(step, `${rel}: the gate step may not be made conditional`).not.toContain(
        '\n        if:'
      );
    }
  });

  it('runs the gate on every push, not only at release', () => {
    // The gate shipped in release.yaml, so between d30ddd0 and today no ordinary push ever ran
    // it: four main pushes packaged all three channels and none re-packaged them. A control that
    // only runs on release day reports a regression at the worst possible moment, so its
    // presence in ci.yml is now pinned too - after packaging, before the hashes.
    const ci = read('.github/workflows/ci.yml');
    const gate = mustFind(
      ci,
      '- name: Assert reproducible package contents',
      'ci.yml reproducibility step'
    );
    // Each packaging step is required by name. Math.max hides a -1 from one renamed step behind the
    // two it did find, and if all three were renamed lastPackage is -1, which makes "the gate runs
    // after packaging" true against steps that are not in the file at all.
    const lastPackage = Math.max(
      mustFind(ci, '- name: Package webOS', 'ci.yml webOS packaging step'),
      mustFind(ci, '- name: Package Tizen', 'ci.yml Tizen packaging step'),
      mustFind(ci, '- name: Package Vizio', 'ci.yml Vizio packaging step')
    );
    const checksums = mustFind(ci, '- name: Generate SHA-256 checksums', 'ci.yml checksum step');
    expect(gate, 'the gate must run after the channels are packaged').toBeGreaterThan(lastPackage);
    expect(gate, 'the gate must run before ci.yml hashes the artifacts').toBeLessThan(checksums);
    // Assert the command line, not the prose: the step's own comment explains why the form is
    // unsigned, and a comment that names a flag must not fail a check on that flag.
    const runLine =
      ci
        .slice(gate, checksums)
        .split('\n')
        .find((l) => l.trim().startsWith('run:')) ?? '';
    expect(runLine, 'the ci.yml gate step lost its command').toContain(
      'check-reproducible-packages.mjs'
    );
    expect(
      runLine,
      'the ci.yml form must stay unsigned: the job has no Tizen Studio profile, and passing ' +
        '--tizen-flags would make it compare a signature it cannot produce'
    ).not.toContain('--tizen-flags');
  });

  it('relocates artifacts without crossing a filesystem boundary', () => {
    // Release rehearsal run 40566120178 (head 479b700) died before it compared anything:
    // `renameSync` moved a packaged .ipk from the runner workspace (disk volume) into a
    // scratch directory under /tmp (tmpfs), and a cross-device rename is not permitted. The
    // same code passes locally because Hermes exports TMPDIR onto the repo's own filesystem,
    // so this contract is the only thing standing between the gate and a second surprise.
    const gate = read('scripts/check-reproducible-packages.mjs');
    expect(
      gate,
      'the gate must create its scratch directory inside the repo, where the artifacts already ' +
        'live: a scratch directory taken from the system temp dir can sit on another filesystem'
    ).toContain("mkdtempSync(join(ROOT, '.repro-'))");
    expect(
      gate,
      'the gate must not rename directly: only the helper below degrades to copy plus remove ' +
        'when the rename reports EXDEV'
    ).not.toContain('renameSync(');
    expect(gate, 'the gate must relocate artifacts through the cross-device-safe helper').toContain(
      'moveFile('
    );

    const helper = read('scripts/lib/fs-move.mjs');
    expect(
      helper,
      'the helper must treat EXDEV as an expected environment and fall back to a copy, while ' +
        'rethrowing every other rename failure so a real problem stays visible'
    ).toContain("error.code !== 'EXDEV'");
    expect(helper, 'the fallback has to actually move the bytes').toContain('copyFileSync');
  });

  it('exposes the gate as a declared package script', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(
      scripts.repro,
      'AGENTS.md lists `npm run repro`; the package script must exist and stay pointed at the gate'
    ).toContain('check-reproducible-packages.mjs');
  });

  it('writes down every difference it accepts', () => {
    const doc = read('docs/reproducible-packages.md');
    const gate = read('scripts/check-reproducible-packages.mjs');
    const accepted = [
      'author-signature.xml',
      'signature1.xml',
      'Installed-Size',
      'SOURCE_DATE_EPOCH',
      'deflateSync',
    ];
    for (const term of accepted) {
      expect(doc, `docs/reproducible-packages.md must document ${term}`).toContain(term);
    }
    for (const entry of ['control/control', 'author-signature.xml', 'signature1.xml']) {
      expect(gate, `the gate must name ${entry} in its accepted-drift lists`).toContain(entry);
    }
    expect(
      gate,
      'the gate compares the extracted payload; hashing the inner tarballs would inherit the ' +
        'container timestamps and report drift that is not application bytes'
    ).toContain("['data.tar.gz', 'data']");
  });

  it('probes for a shipped artifact instead of demanding one', () => {
    // Running the gate against a tree that had been packaged and then cleared exited 1 with
    // "expected exactly one .ipk, found 0" and printed no report: build/ survives packaging
    // (package-meta.json, stage/), so the existsSync guard passed and the strict lookup threw.
    // The required/probed distinction now lives in scripts/lib/artifact-lookup.mjs, where both
    // directions are unit-tested against real directories.
    const gate = read('scripts/check-reproducible-packages.mjs');
    expect(
      gate,
      'the gate must use the artifact lookup module: its own strict helper threw on a tree with ' +
        'no artifact, which is a state the release job can reach'
    ).toContain("from './lib/artifact-lookup.mjs'");
    expect(gate, 'the shipped-artifact probe must be the non-throwing form').toContain(
      'findArtifact(buildDir, platform.ext)'
    );
    expect(
      gate,
      'the gate must not go back to a single lookup used for both a requirement and a probe'
    ).not.toContain('singleArtifact');

    const lib = read('scripts/lib/artifact-lookup.mjs');
    expect(lib, 'a missing artifact must be a value, not an exception').toContain('return null');
    expect(lib, 'two candidates must still be an error').toContain('at most one');
  });

  it('renders its verdict through the module the wording tests cover', () => {
    // The two overclaims an adversarial review found at 479b700 (`bytes identical` printed for
    // the byte-exempt container, `shipped artifact re-derivable` printed when the shipped
    // comparison had been skipped) lived in verdict strings built inline in the gate, where no
    // fast test could see them. Splitting the wording out is only durable if the split is
    // asserted, so: the gate must import the renderer, and must not compose verdict text.
    const gate = read('scripts/check-reproducible-packages.mjs');
    expect(
      gate,
      'the gate must render through scripts/lib/repro-report.mjs so its exact verdict wording is ' +
        'covered by scripts/tests/repro-report.test.mjs'
    ).toContain("from './lib/repro-report.mjs'");
    expect(
      gate,
      'the gate must not build verdict text itself: inline wording is what let an unmeasured ' +
        'positive verdict reach a reviewer'
    ).not.toContain('across passes');

    const renderer = read('scripts/lib/repro-report.mjs');
    for (const clause of [
      'bytes identical across passes',
      'container bytes not byte-pinned',
      'shipped comparison skipped',
      'documented exception',
    ]) {
      expect(renderer, `the renderer must be able to print ${clause}`).toContain(clause);
    }
    expect(
      existsSync(resolve(ROOT, 'scripts/tests/repro-report.test.mjs')),
      'the renderer needs its own wording test; a report nobody reads cannot be audited'
    ).toBe(true);
  });

  it('pins the toolchain-dependent asset instead of accepting its drift (WEB-015a)', () => {
    // Measured on one host from the same source: Node 20.20.2 and 22.23.3 emit `splash.png`
    // `7d4994d1` / 4198 B - the published `v0.1.0` bytes - while this host's 22.22.1 emits
    // `899aea56` / 4188 B for art that decodes to the same pixels. The answer is a checked-in
    // input, not another row in the accepted-differences table: a release built on one Node has
    // to match a release built on another, or the published SHA-256 is decorative.
    expect(
      existsSync(resolve(ROOT, 'assets/generated/splash.png')),
      'the pinned splash must ship in the repo: the webOS packager stages it, and without it ' +
        'packaging falls back to whatever zlib the host happens to run'
    ).toBe(true);
    const doc = read('docs/reproducible-packages.md');
    for (const term of ['assets/generated/splash.png', 'icons:pin']) {
      expect(doc, `docs/reproducible-packages.md must document ${term}`).toContain(term);
    }
    const packager = read('platforms/webos/scripts/package.sh');
    expect(
      packager,
      'the webOS packager must stage the pinned splash; staging the freshly deflated file is ' +
        'what made published bytes depend on the build'
    ).toContain('assets/generated/splash.png');
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(
      scripts['icons:pin'],
      'AGENTS.md lists `npm run icons:pin`; the package script must exist and stay pointed at ' +
        'the re-renderer, or a design change has no documented way to update the pin'
    ).toContain('pin-splash.mjs');
  });
});
