/**
 * Drift classification and the runtime floor (WEB-015).
 *
 * Why this file exists: the release job died with `TypeError: Set.intersection is not a
 * function` at 2026-10-27T20:00:09Z (run 40567897486, step "Assert reproducible package
 * contents"). The gate compared shipped drift with `Set.prototype.intersection`, which is
 * Node 22+, while `.github/workflows/release.yaml`, `.github/workflows/ci.yml` and
 * `engines.node` all say Node 20. Every local proof had run on Node 22, so the one assertion
 * that protects a release had never executed on the runtime that publishes one. Reproduced
 * byte-for-byte on this host with `node v20.20.2`: exit 1, same TypeError.
 *
 * Two things follow, and both are pinned here: the classification must work on the declared
 * floor, and the gate must name its runtime instead of dying halfway through a report.
 */
import { describe, expect, it } from 'vitest';
import { acceptedDrift, parseRuntime } from '../lib/repro-report.mjs';

describe('shipped drift classification (WEB-015)', () => {
  it('accepts a documented entry on the built side', () => {
    const r = acceptedDrift({
      extra: ['signature1.xml'],
      missing: [],
      changed: [],
      acceptedExtraEntries: ['author-signature.xml', 'signature1.xml'],
    });
    expect(r.accepted).toEqual(['signature1.xml']);
    expect(r.unexpected).toEqual([]);
  });

  it('accepts the same entry on the shipped side, because either direction is a legitimate pairing', () => {
    const r = acceptedDrift({
      extra: [],
      missing: ['author-signature.xml', 'signature1.xml'],
      changed: [],
      acceptedExtraEntries: ['author-signature.xml', 'signature1.xml'],
    });
    expect(r.accepted).toEqual(['author-signature.xml', 'signature1.xml']);
    expect(r.unexpected).toEqual([]);
  });

  it('reports anything outside the documented set as unexpected', () => {
    const r = acceptedDrift({
      extra: ['evil.txt'],
      missing: [],
      changed: ['app.js'],
      acceptedExtraEntries: ['signature1.xml'],
      acceptedChangedEntries: [],
    });
    expect(r.unexpected).toEqual(['evil.txt', 'app.js']);
    expect(r.accepted).toEqual([]);
  });

  it('counts a changed entry as accepted only when that entry is documented as changed-allowed', () => {
    const r = acceptedDrift({
      extra: [],
      missing: [],
      changed: ['author-signature.xml', 'app.js'],
      acceptedExtraEntries: ['author-signature.xml'],
      acceptedChangedEntries: ['author-signature.xml'],
    });
    expect(r.accepted).toEqual(['author-signature.xml']);
    expect(r.unexpected).toEqual(['app.js']);
  });

  it('names an entry once even when it shows up on both sides of the comparison', () => {
    const r = acceptedDrift({
      extra: ['signature1.xml'],
      missing: ['signature1.xml'],
      changed: [],
      acceptedExtraEntries: ['signature1.xml'],
    });
    expect(r.accepted).toEqual(['signature1.xml']);
    expect(r.unexpected).toEqual([]);
  });

  it('is empty on both sides when nothing drifted', () => {
    expect(acceptedDrift({})).toEqual({ accepted: [], unexpected: [] });
  });
});

describe('runtime floor (WEB-015)', () => {
  it('accepts the Node the workflows pin', () => {
    expect(parseRuntime('v20.20.2')).toMatchObject({ major: 20, supported: true });
  });

  it('accepts the Node every local proof in this arc ran on', () => {
    expect(parseRuntime('v22.22.1')).toMatchObject({ major: 22, supported: true });
  });

  it('rejects a runtime below engines.node, with a reason that names the pin', () => {
    const r = parseRuntime('v18.20.4');
    expect(r.supported).toBe(false);
    expect(r.reason).toMatch(/20/);
  });

  it('rejects a runtime it cannot parse instead of trusting it', () => {
    for (const bad of ['', undefined, 'node', 'canary']) {
      const r = parseRuntime(bad);
      expect(r.supported).toBe(false);
      expect(r.major).toBeNull();
    }
  });
});
