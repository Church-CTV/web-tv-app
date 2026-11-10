import { beforeAll, afterAll, describe, test, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const script = join(process.cwd(), 'scripts/validate-tizen-signature.mjs');
let dir;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tizen-crypto-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function archive(name, entries) {
  const path = join(dir, `${name}.wgt`);
  execFileSync('python3', [
    '-c',
    'import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],"w") as z:\n for n,v in json.loads(sys.argv[2]): z.writestr(n,v)',
    path,
    JSON.stringify(entries),
  ]);
  return path;
}
function run(path, env = process.env) {
  const r = spawnSync(process.execPath, [script, path], { encoding: 'utf8', env });
  return { status: r.status, output: r.stdout + r.stderr };
}
const fake =
  '<Signature><SignedInfo/><SignatureValue>fake</SignatureValue><KeyInfo/><Reference/><DigestValue/><dsp:Identifier/>' +
  'x'.repeat(600);
test('rejects fabricated XML signatures previously accepted', () => {
  const r = run(
    archive('fake', [
      ['config.xml', '<widget/>'],
      ['author-signature.xml', fake],
      ['signature1.xml', fake],
    ])
  );
  expect(r.status, r.output).toBe(1);
});
test.each(['../escape', '/absolute', 'a/../escape', 'a\\escape'])(
  'rejects unsafe archive entry %s',
  (name) => {
    const r = run(
      archive('unsafe', [
        ['config.xml', 'x'],
        [name, 'x'],
      ])
    );
    expect(r.status).toBe(1);
    expect(r.output).toMatch(/unsafe|path/i);
  }
);
test('rejects duplicate archive entries', () => {
  const r = run(
    archive('duplicates', [
      ['config.xml', 'a'],
      ['config.xml', 'b'],
    ])
  );
  expect(r.status).toBe(1);
  expect(r.output).toMatch(/duplicate/i);
});
test('fails closed when XMLDSig verifier is unavailable', () => {
  const r = run(
    archive('no-verifier', [
      ['config.xml', 'x'],
      ['author-signature.xml', fake],
      ['signature1.xml', fake],
    ]),
    { ...process.env, TIZEN_XMLSEC1: '/nonexistent/xmlsec1' }
  );
  expect(r.status).toBe(1);
  expect(r.output).toMatch(/xmlsec1.*unavailable/i);
});
test('metadata JSON never claims cryptographic verification', () => {
  const path = join(dir, 'metadata.json');
  writeFileSync(path, JSON.stringify({ signatures: ['author-signature.xml', 'signature1.xml'] }));
  const r = run(path);
  expect(r.status, r.output).toBe(0);
  expect(r.output).toMatch(/structure only/i);
  expect(r.output).toMatch(/cryptographic verification.*not performed/i);
});

// Fixed canonical XML fixture serialization, not a production canonicalizer.
// Expanded empty elements and a single explicit namespace match inclusive C14N 1.0.
const ns = 'http://www.w3.org/2000/09/xmldsig#';
function signedXml(files, key, cert) {
  const refs = files
    .map(
      ([name, data]) =>
        `<Reference URI="${name}"><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod><DigestValue>${createHash('sha256').update(data).digest('base64')}</DigestValue></Reference>`
    )
    .join('');
  const body = `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>${refs}`;
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(`<SignedInfo xmlns="${ns}">${body}</SignedInfo>`),
    key
  ).toString('base64');
  return `<Signature xmlns="${ns}"><SignedInfo>${body}</SignedInfo><SignatureValue>${signature}</SignatureValue><KeyInfo><X509Data><X509Certificate>${cert}</X509Certificate></X509Data></KeyInfo></Signature>`;
}
describe('real cryptographic WGT fixtures (requires xmlsec1)', () => {
  let files;
  beforeAll(() => {
    const keyPath = join(dir, 'key.pem');
    const certPath = join(dir, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-subj',
        '/CN=Synthetic Test Only',
        '-days',
        '1',
      ],
      { stdio: 'pipe' }
    );
    const key = readFileSync(keyPath);
    const cert = readFileSync(certPath, 'utf8')
      .replace(/-----[^-]+-----/g, '')
      .replace(/\s/g, '');
    const payload = [
      ['config.xml', '<widget/>'],
      ['index.html', 'original payload'],
    ];
    const author = ['author-signature.xml', signedXml(payload, key, cert)];
    files = [...payload, author, ['signature1.xml', signedXml([...payload, author], key, cert)]];
  });
  test('rejects nested XMLDSig manifests before invoking the verifier', () => {
    const changed = files.map((entry) => [...entry]);
    changed[2][1] = changed[2][1].replace(
      '</Signature>',
      '<Object><Manifest><Reference URI="https://unexpected.invalid/payload"/></Manifest></Object></Signature>'
    );
    const r = run(archive('nested-manifest', changed));
    expect(r.status, r.output).toBe(1);
    expect(r.output).toContain('XMLDSig Manifest forbidden');
  });
  test('verifies actual author and distributor signatures', () => {
    const r = run(archive('real', files));
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain('cryptographic integrity verified');
    expect(r.output).toContain('approval NOT verified');
  });
  test.each([
    'payload',
    'signature',
    'extra',
    'wrong digest',
    'dangling digest',
    'author coverage',
    'distributor coverage',
  ])('rejects %s tampering', (kind) => {
    const changed = files.map((entry) => [...entry]);
    if (kind === 'payload') changed[1][1] += 'tamper';
    if (kind === 'signature')
      changed[3][1] = changed[3][1].replace(/<SignatureValue>./, '<SignatureValue>A!');
    if (kind === 'extra') changed.push(['extra.js', 'unsigned']);
    if (kind === 'wrong digest')
      changed[3][1] = changed[3][1].replace(/<DigestValue>./, '<DigestValue>!');
    if (kind === 'dangling digest')
      changed[3][1] = changed[3][1].replace('URI="config.xml"', 'URI="missing.xml"');
    if (kind === 'author coverage')
      changed[2][1] = changed[2][1].replace(/<Reference URI="index.html">.*?<\/Reference>/, '');
    if (kind === 'distributor coverage')
      changed[3][1] = changed[3][1].replace(
        /<Reference URI="author-signature.xml">.*?<\/Reference>/,
        ''
      );
    const r = run(archive(`tamper-${kind.replaceAll(' ', '-')}`, changed));
    expect(r.status, r.output).toBe(1);
  });
});
