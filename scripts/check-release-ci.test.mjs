import { describe, it, expect } from 'vitest';
import { checkReleaseCI } from './check-release-ci.mjs';
const sha = 'a'.repeat(40);
const run = (extra = {}) => ({
  id: 1,
  name: 'CI & Certification',
  path: '.github/workflows/ci.yml',
  head_sha: sha,
  status: 'completed',
  conclusion: 'success',
  ...extra,
});
function api(pages) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ workflow_runs: pages.shift() ?? [] }) };
    },
  };
}
describe('release CI prerequisite', () => {
  it('authenticates and accepts exact completed successful SHA', async () => {
    const fake = api([[run()]]);
    await expect(
      checkReleaseCI({ repository: 'owner/repo', sha, token: 'fixture', fetchImpl: fake.fetch })
    ).resolves.toBe(1);
    expect(fake.calls[0].options.headers.Authorization).toBe('Bearer fixture');
    expect(fake.calls[0].url).toContain(`head_sha=${sha}`);
  });
  it.each(
    [
      [],
      [run({ head_sha: 'b'.repeat(40) })],
      [run({ status: 'queued', conclusion: null })],
      [run({ conclusion: 'failure' })],
      [run({ name: 'Other workflow' })],
    ].map((runs) => [runs])
  )('rejects absent, stale, pending or failed runs: %j', async (...args) => {
    const fake = api([args[0]]);
    await expect(
      checkReleaseCI({ repository: 'owner/repo', sha, token: 'fixture', fetchImpl: fake.fetch })
    ).rejects.toThrow(/successful CI/);
  });
  it('uses the newest exact run, rejecting failed reruns despite old success', async () => {
    const fake = api([[run({ id: 2, conclusion: 'failure' }), run()]]);
    await expect(
      checkReleaseCI({ repository: 'owner/repo', sha, token: 'fixture', fetchImpl: fake.fetch })
    ).rejects.toThrow(/successful CI/);
  });
  it('paginates with a finite bound', async () => {
    const fake = api([
      Array.from({ length: 100 }, () => run({ head_sha: 'b'.repeat(40) })),
      [run()],
    ]);
    await expect(
      checkReleaseCI({ repository: 'owner/repo', sha, token: 'fixture', fetchImpl: fake.fetch })
    ).resolves.toBe(1);
    expect(fake.calls[1].url).toContain('page=2');
  });
  it('stops after the configured pagination bound and supplies request timeouts', async () => {
    const fake = api(
      Array.from({ length: 3 }, () =>
        Array.from({ length: 100 }, () => run({ head_sha: 'b'.repeat(40) }))
      )
    );
    await expect(
      checkReleaseCI({
        repository: 'owner/repo',
        sha,
        token: 'fixture',
        fetchImpl: fake.fetch,
        maxPages: 2,
      })
    ).rejects.toThrow(/within 2 pages/);
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0].options.signal).toBeInstanceOf(AbortSignal);
  });
  it('rejects missing credentials and API failure', async () => {
    await expect(checkReleaseCI({ repository: 'owner/repo', sha })).rejects.toThrow(/token/);
    await expect(
      checkReleaseCI({
        repository: 'owner/repo',
        sha,
        token: 'fixture',
        fetchImpl: async () => ({ ok: false, status: 403 }),
      })
    ).rejects.toThrow(/403/);
  });
});
