import { pathToFileURL } from 'node:url';

/** Fail closed: the newest CI run for these exact bytes must have succeeded. */
export async function checkReleaseCI({
  repository,
  sha,
  token,
  fetchImpl = fetch,
  apiURL = 'https://api.github.com',
  maxPages = 10,
}) {
  if (!token) throw new Error('GitHub token is required');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !/^[a-f0-9]{40}$/i.test(sha ?? ''))
    throw new Error('Repository and exact commit SHA required');
  for (let page = 1; page <= maxPages; page++) {
    const url = `${apiURL}/repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=100&page=${page}`;
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`GitHub CI lookup failed: HTTP ${response.status}`);
    const { workflow_runs: runs } = await response.json();
    if (!Array.isArray(runs)) throw new Error('Invalid GitHub workflow response');
    const exact = runs.filter(
      (r) =>
        r.head_sha === sha &&
        r.name === 'CI & Certification' &&
        r.path === '.github/workflows/ci.yml'
    );
    if (exact.length) {
      const latest = exact.reduce((a, b) => (Number(a.id) > Number(b.id) ? a : b));
      if (latest.status !== 'completed' || latest.conclusion !== 'success')
        throw new Error(
          `No successful CI & Certification for ${sha}: run ${latest.id} ${latest.status}/${latest.conclusion}`
        );
      return latest.id;
    }
    if (runs.length < 100) break;
  }
  throw new Error(`No successful CI & Certification for exact SHA ${sha} within ${maxPages} pages`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkReleaseCI({
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    token: process.env.GH_TOKEN,
    apiURL: process.env.GITHUB_API_URL,
  })
    .then((id) => console.log(`Certified by CI run ${id}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
