import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public startup defaults', () => {
  for (const platform of ['webos', 'tizen', 'vizio']) {
    it(`${platform} uses a local demo origin`, () => {
      const source = readFileSync(`platforms/${platform}/src/App.ts`, 'utf8');
      expect(source.match(/baseUrl: 'http:\/\/localhost:3000'/g)).toHaveLength(2);
    });
  }
  it('does not advertise a customer server in recovery', () => {
    expect(readFileSync('shared/ui/StartupRecovery.ts', 'utf8')).toContain('http://localhost:3000');
  });
  it('does not ship customer giving links or QR assets', () => {
    for (const platform of ['webos', 'tizen', 'vizio']) {
      expect(readFileSync(`platforms/${platform}/src/ui/SettingsScreen.ts`, 'utf8')).not.toMatch(/https?:\/\/|qr-giving\.png/i);
    }
  });
});
