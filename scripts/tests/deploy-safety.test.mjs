const { test } = process.env.VITEST ? await import('vitest') : await import('node:test');
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function deploy(mode = '', artifact = true, profile = 'example-profile') {
  const root = mkdtempSync(join(tmpdir(), 'deploy-safety-'));
  try {
    const dir = join(root, 'platforms/tizen');
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'build'));
    mkdirSync(join(root, 'bin'));
    copyFileSync('platforms/tizen/scripts/deploy.sh', join(dir, 'scripts/deploy.sh'));
    copyFileSync('platforms/tizen/config.xml', join(dir, 'config.xml'));
    writeFileSync(join(dir, 'scripts/package.sh'), '#!/bin/bash\necho "package $*" >> "$LOG"\n', {
      mode: 0o755,
    });
    writeFileSync(join(dir, 'build/signed.wgt'), 'immutable signed bytes');
    for (const tool of ['node', 'npm', 'sdb', 'tizen']) {
      writeFileSync(
        join(root, 'bin', tool),
        `#!/bin/bash
echo '${tool}' "$@" >> "$LOG"
case '${tool}' in
node) [[ "$MODE" != invalid ]];;
sdb) [[ "$MODE" != connect-fail ]];;
tizen)
 if [[ "$1" == install ]]; then
   [[ "$MODE" != install-fail ]] || exit 1
   [[ "$MODE" == no-install-proof ]] || echo 'install completed'
 else
   [[ "$MODE" != launch-fail ]] || exit 1
   if [[ "$MODE" == stale-pid ]]; then echo 'launch failed; previous pid = 1234';
   elif [[ "$MODE" != no-pid ]]; then echo 'successfully launched pid = 1234'; fi
 fi;;
esac
`,
        { mode: 0o755 }
      );
    }
    const file = join(dir, 'build/signed.wgt');
    const result = spawnSync(
      'bash',
      [
        join(dir, 'scripts/deploy.sh'),
        '--tv-ip',
        '192.0.2.1',
        ...(artifact ? ['--artifact', file] : []),
      ],
      {
        env: {
          ...process.env,
          PATH: `${root}/bin:${process.env.PATH}`,
          LOG: join(root, 'log'),
          MODE: mode,
          TIZEN_CERT_PROFILE: profile,
        },
        encoding: 'utf8',
      }
    );
    let log = '';
    try {
      log = readFileSync(join(root, 'log'), 'utf8');
    } catch {
      // No external process ran before argument rejection.
    }
    assert.equal(readFileSync(file, 'utf8'), 'immutable signed bytes');
    return { ...result, log };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('validated existing artifact installs exact bytes and launches once using serial', () => {
  const r = deploy();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.log, /node .*validate-tizen-signature.mjs .*signed.wgt/);
  assert.doesNotMatch(r.log, /npm|package |docker/);
  assert.match(r.log, /sdb connect 192.0.2.1:26101/);
  assert.match(r.log, /tizen install -n signed.wgt -s 192.0.2.1:26101 -- /);
  assert.match(r.log, /tizen run -p ChromaTV01.Jellyfin -s 192.0.2.1:26101/);
  assert.ok(r.log.indexOf('validate-tizen-signature.mjs') < r.log.indexOf('sdb connect'));
  assert.equal((r.log.match(/sdb connect/g) || []).length, 1);
  assert.equal((r.log.match(/tizen install/g) || []).length, 1);
  assert.equal((r.log.match(/tizen run/g) || []).length, 1);
});
for (const mode of [
  'invalid',
  'connect-fail',
  'install-fail',
  'no-install-proof',
  'launch-fail',
  'no-pid',
  'stale-pid',
]) {
  test(`fails closed without retry: ${mode}`, () => {
    const r = deploy(mode);
    assert.notEqual(r.status, 0);
    if (mode === 'invalid') assert.doesNotMatch(r.log, /^(sdb|tizen) /m);
    if (['connect-fail', 'install-fail', 'no-install-proof'].includes(mode))
      assert.doesNotMatch(r.log, /tizen run/);
    assert.ok((r.log.match(/tizen install/g) || []).length <= 1);
    assert.ok((r.log.match(/tizen run/g) || []).length <= 1);
  });
}
test('build path signs only with the explicitly configured profile', () => {
  const r = deploy('', false);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.log, /npm run build/);
  assert.match(r.log, /package --skip-build --sign --profile example-profile --output signed.wgt/);
});
test('build path refuses an unconfigured signing profile before building or connecting', () => {
  const result = deploy('', false, '');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.log, /npm|package |sdb|tizen/);
});
