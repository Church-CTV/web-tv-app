import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const workflows = readdirSync('.github/workflows').filter(name => /\.ya?ml$/.test(name)).map(name => readFileSync('.github/workflows/' + name, 'utf8'));
describe('public source deployment boundaries', () => {
  it('ships no privileged deployment workflow', () => {
    expect(existsSync('.github/workflows/deploy.yaml')).toBe(false);
    for (const workflow of workflows) {
      expect(workflow).not.toMatch(/secrets\.|self-hosted|pull_request_target|contents: write|--tv-ip|SCS_API_KEY|curl .* -X POST/);
    }
  });
  it('keeps signature verification ahead of device access in local Tizen tooling', () => {
    const script = readFileSync('platforms/tizen/scripts/deploy.sh', 'utf8');
    const signature = script.indexOf('node "$REPO_ROOT/scripts/validate-tizen-signature.mjs"');
    const connect = script.indexOf('"$SDB_CLI" connect');
    expect(signature).toBeGreaterThan(0);
    expect(connect).toBeGreaterThan(signature);
    expect(script.indexOf('"$TIZEN_CLI" install')).toBeGreaterThan(connect);
    expect(script).toContain('TIZEN_CERT_PROFILE required');
    expect(script).not.toMatch(/chroma-tizen|StrictHostKeyChecking=no|--retry/);
  });
  it('keeps Vizio packaging local, with no vendor upload or credential dependency', () => {
    const script = readFileSync('platforms/vizio/scripts/package.sh', 'utf8');
    expect(script).toContain('validate-vizio-package.mjs');
    expect(script).not.toMatch(/curl|SCS_API_KEY|--upload/);
  });
});
