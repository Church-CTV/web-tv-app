/**
 * Package-metadata contract: every artifact the release job uploads must be one it
 * can prove.
 *
 * Why this file exists: `release.yaml` uploads `platforms/<p>/build/package-meta.json`
 * for all three platforms and the upload is fail-closed (`if-no-files-found: error`).
 * Vizio's packager never wrote that file, so the first tag push would have died in the
 * upload step and cut no release at all - a gap no test could see, because the release
 * job only runs on a tag and nothing locally asserted which paths it names. This file
 * asserts the workflow and the packagers agree, in both directions.
 *
 * The rule it locks: a platform is in the release exactly when its packager records
 * metadata AND the job gates that metadata. Either half missing is a defect:
 *   - path listed, no writer      -> the upload fails and no release is published;
 *   - writer, no validate step    -> bytes reach the release page ungated;
 *   - `if-no-files-found` missing -> an empty upload reports success.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const PLATFORMS = ['webos', 'tizen', 'vizio'] as const;

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const releaseYaml = read('.github/workflows/release.yaml');

/** The `path:` block of the upload-artifact step, as literal lines. */
function uploadPaths(): string[] {
  const step = releaseYaml.match(
    /uses:\s*actions\/upload-artifact[\s\S]*?(?=\n {6}- name:|\n {6}- uses:|$)/
  );
  if (!step) throw new Error('release.yaml: no upload-artifact step found');
  const block = step[0];
  const paths = [...block.matchAll(/^\s{12}(\S[^\n]*)$/gm)].map((m) => m[1].trim());
  expect(paths.length, 'release.yaml: the upload step lists no paths').toBeGreaterThan(0);
  return paths;
}

/** Named steps of the release job, joined so a step's run line can be found by name. */
function stepRun(stepName: string): string | null {
  const re = new RegExp(
    `- name: ${stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n((?:[ ]{8}.*\\n?)*?)(?=\\n      - |\\n    - |$)`
  );
  const m = releaseYaml.match(re);
  return m ? m[1] : null;
}

function packagerScript(platform: string): string {
  const rel = `platforms/${platform}/scripts/package.sh`;
  expect(existsSync(resolve(ROOT, rel)), `${rel} is missing`).toBe(true);
  return read(rel);
}

/** Which packagers actually write build/package-meta.json. */
function writesMeta(platform: string): boolean {
  return /META_FILE="\$BUILD_DIR\/package-meta\.json"/.test(packagerScript(platform));
}

describe('release package-metadata contract', () => {
  const paths = uploadPaths();

  it('fails the upload instead of publishing an empty artifact set', () => {
    expect(
      releaseYaml,
      'release.yaml: the upload step must set if-no-files-found: error, or a packaging ' +
        'step that produced nothing still publishes a release with no artifacts'
    ).toMatch(/if-no-files-found:\s*error/);
  });

  for (const platform of PLATFORMS) {
    const metaPath = `platforms/${platform}/build/package-meta.json`;
    const listed = paths.includes(metaPath);

    it(`keeps ${platform}'s metadata writer, upload path and gate in agreement`, () => {
      const writer = writesMeta(platform);
      const gate = stepRun(
        `Validate ${platform === 'webos' ? 'webOS' : platform === 'tizen' ? 'Tizen' : 'Vizio'} package is store-ready`
      );

      if (!listed && !writer) {
        // A platform deliberately outside the release: nothing to assert beyond the
        // agreement itself, which is the point.
        return;
      }
      expect(
        writer,
        `release.yaml uploads ${metaPath} but platforms/${platform}/scripts/package.sh never ` +
          'writes it, so the upload step fails closed and NO release gets published'
      ).toBe(true);
      expect(
        gate,
        `release.yaml packages ${platform} and uploads its metadata, but the job has no ` +
          '"Validate ... package is store-ready" step, so those bytes reach the release page ' +
          'with no store-readiness gate behind them'
      ).not.toBeNull();
      expect(gate!, `the ${platform} store-readiness gate must check ${metaPath}`).toContain(
        `check-store-ready.mjs ${metaPath}`
      );
    });
  }

  it('validates the metadata of every platform it ships', () => {
    const shipped = PLATFORMS.filter((p) =>
      paths.some((x) => x.startsWith(`platforms/${p}/build/`))
    );
    const gated = PLATFORMS.filter(
      (p) =>
        stepRun(
          `Validate ${p === 'webos' ? 'webOS' : p === 'tizen' ? 'Tizen' : 'Vizio'} package is store-ready`
        ) !== null
    );
    expect(gated.sort(), 'the release job must gate every artifact set it uploads').toEqual(
      shipped.sort()
    );
  });

  it('gates every platform the upload block names, whoever that platform is', () => {
    // Derived from the workflow itself, so a fourth platform cannot be added to the
    // upload block and escape the contract just because it is not in PLATFORMS.
    const named = [
      ...new Set(
        paths
          .map((p) => p.match(/^platforms\/([a-z0-9-]+)\/build\//)?.[1])
          .filter((x): x is string => !!x)
      ),
    ];
    expect(named.length, 'the upload block names no platform artifacts at all').toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const platform of named) {
      const metaPath = `platforms/${platform}/build/package-meta.json`;
      if (!paths.includes(metaPath)) {
        offenders.push(`${platform}: upload block ships artifacts but never uploads its metadata`);
        continue;
      }
      if (!writesMeta(platform)) {
        offenders.push(
          `${platform}: upload block lists ${metaPath}, which its packager never writes`
        );
      }
      const gate = releaseYaml.match(
        new RegExp(
          `- name: Validate [^\\n]*package is store-ready\\n(?:[ ]{8}.*\\n?)*?${platform}/build/package-meta\\.json`
        )
      );
      if (!gate) {
        offenders.push(`${platform}: metadata is uploaded with no store-readiness gate step`);
      }
    }
    expect(offenders, 'release.yaml is not self-consistent').toEqual([]);
  });

  it('keeps the release job free of phantom paths', () => {
    // A path that no step can produce turns if-no-files-found: error into a release
    // that never gets cut. Every literal (non-glob, non-directory) path must exist on
    // disk after packaging, which locally means either it is a generated release file
    // or it lives under a build directory the packager owns.
    const generated = new Set(['checksums.txt', 'provenance.json']);
    const phantom = paths.filter(
      (p) =>
        !p.includes('*') && !p.endsWith('/') && !p.startsWith('platforms/') && !generated.has(p)
    );
    expect(
      phantom,
      'release.yaml upload paths name files nothing generates: ' + phantom.join(', ')
    ).toEqual([]);
  });
});

describe('release Create Release step contract', () => {
  /**
   * R6B F2, amended by run 40517190702: `softprops/action-gh-release@v3` keeps the
   * release's existing `target_commitish` when the step does not set one (its
   * github.ts preserves the old value on re-run), so the value must be pinned or
   * force-moving a published tag updates the assets while the release page keeps
   * pointing at the previous commit.
   *
   * Pinning it to the tag REF was wrong: that reading of the action source never
   * exercised the Releases API, which answered the first real tag push with
   * 422 Validation Failed {"resource":"Release","code":"invalid","field":
   * "target_commitish"} and killed the publish step after every packaging gate had
   * already passed - packaging, signing, validation, checksums, SBOMs, provenance and
   * the artifact upload all green, and no release page. `github.sha` on a tag push is
   * the commit the tag points at, so it is both accepted by the API and exactly the
   * commit CI certified.
   */
  it('binds the release to the tested commit so a moved tag cannot strand the page', () => {
    const step = releaseYaml.match(
      /uses:\s*softprops\/action-gh-release[\s\S]*?(?=\n {6}- name:|\n {6}- uses:|$)/
    );
    expect(step, 'release.yaml: no Create Release step found').not.toBeNull();
    const binding = step![0].match(/^\s*target_commitish:\s*(.+?)\s*$/m);
    expect(
      binding,
      'the Create Release step sets no target_commitish, so a re-run keeps the old commit'
    ).not.toBeNull();
    expect(binding![1]).toBe('${{ github.sha }}');
    expect(
      binding![1],
      'target_commitish must not name a ref: the Releases API rejects a ref name with ' +
        '422 {"resource":"Release","field":"target_commitish"}, which is how run ' +
        '40517190702 failed after packaging had already succeeded'
    ).not.toContain('ref_name');
  });
});
