const { test } = process.env.VITEST ? await import('vitest') : await import('node:test');
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const deploy = readFileSync('.github/workflows/deploy.yaml', 'utf8');
const release = readFileSync('.github/workflows/release.yaml', 'utf8');
function gate(workflow) {
  const step = workflow
    .split('- name: Require successful exact-SHA CI and certification')[1]
    ?.split('\n      - ')[0];
  assert.ok(step, 'CI gate step exists');
  return step
    .split('        run: |\n')[1]
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(10))
    .join('\n');
}
for (const [event, matches, success] of [
  ['workflow_dispatch', false, true],
  ['push', false, false],
  ['push', true, true],
]) {
  test(`release exact checkout gate: ${event}, event matches=${matches}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'workflow-gate-'));
    try {
      for (const [tool, body] of Object.entries({
        git: 'echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        node: 'test "$GITHUB_SHA" = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })) {
        writeFileSync(join(root, tool), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
      }
      const r = spawnSync('bash', ['-e', '-c', gate(release)], {
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          GITHUB_EVENT_NAME: event,
          GITHUB_SHA: (matches ? 'a' : 'b').repeat(40),
        },
      });
      assert.equal(r.status === 0, success, r.stderr?.toString());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
test('production gate precedes build; signed validation precedes upload and same artifact deploy', () => {
  assert.match(deploy, /permissions:\n {2}contents: read\n {2}actions: read/);
  assert.match(deploy, /if: inputs.environment == 'production'/);
  assert.ok(deploy.indexOf('node scripts/check-release-ci.mjs') < deploy.indexOf('- name: Build'));
  assert.match(deploy, /package.sh --skip-build --sign --profile "\$TIZEN_PROFILE"/);
  for (const gate of ['check-store-ready.mjs', 'validate-tizen-signature.mjs']) {
    assert.ok(deploy.indexOf(gate) > 0);
    assert.ok(deploy.indexOf(gate) < deploy.indexOf('- name: Upload channel artifact'));
  }
  assert.match(deploy, /--artifact "\$TIZEN_ARTIFACT"/);
  assert.match(deploy, /path: .*env.TIZEN_ARTIFACT/);
  assert.doesNotMatch(deploy, /cache: ['"]?npm/);
});

for (const mode of ['ok', 'metadata', 'signature', 'multiple', 'missing']) {
  test(`Tizen workflow artifact validation fails closed: ${mode}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'workflow-artifact-'));
    try {
      mkdirSync(join(root, 'platforms/tizen/build'), { recursive: true });
      if (mode !== 'missing')
        writeFileSync(join(root, 'platforms/tizen/build/signed.wgt'), 'bytes');
      if (mode === 'multiple')
        writeFileSync(join(root, 'platforms/tizen/build/stale.wgt'), 'stale');
      writeFileSync(
        join(root, 'node'),
        `#!/bin/bash
case "$1" in
*check-store-ready*) [[ "$MODE" != metadata ]];;
*validate-tizen-signature*) [[ "$MODE" != signature ]];;
*) exit 99;;
esac
`,
        { mode: 0o755 }
      );
      const step = deploy
        .split('- name: Validate selected package before upload or device actions')[1]
        .split('\n      - ')[0];
      const script = step
        .split('        run: |\n')[1]
        .split('\n')
        .filter(Boolean)
        .map((l) => l.slice(10))
        .join('\n');
      const r = spawnSync('bash', ['-e', '-c', script], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          PLATFORM: 'tizen',
          ENVIRONMENT: 'production',
          MODE: mode,
          GITHUB_ENV: join(root, 'env'),
        },
      });
      assert.equal(r.status === 0, mode === 'ok', r.stderr?.toString());
      if (mode === 'ok')
        assert.equal(
          readFileSync(join(root, 'env'), 'utf8').trim(),
          'TIZEN_ARTIFACT=platforms/tizen/build/signed.wgt'
        );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('only tag push publishes; release target remains event SHA pinned', () => {
  const step = release.split('- name: Create Release')[1];
  assert.match(
    step,
    /if: github.event_name == 'push' && startsWith\(github.ref, 'refs\/tags\/v'\)/
  );
  assert.ok(step.includes('target_commitish: ${{ github.sha }}'));
});

test('Vizio upload uses the validated package after the validation step', () => {
  const packaging = deploy
    .split('- name: Package ${{ inputs.platform }}')[1]
    .split('\n      - ')[0];
  assert.doesNotMatch(packaging, /--upload/);
  const validation = deploy.indexOf(
    '- name: Validate selected package before upload or device actions'
  );
  const upload = deploy.indexOf('- name: Upload validated Vizio package');
  assert.ok(upload > validation, 'Vizio external upload follows package validation');
  assert.match(deploy.slice(upload), /SCS_API_KEY: \$\{\{ secrets.SCS_API_KEY \}\}/);
  assert.match(deploy.slice(upload), /curl --fail-with-body/);
});
