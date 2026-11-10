import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('webOS ACG submission declaration', () => {
  it('declares no Luna access groups for the current app', () => {
    const appinfo = JSON.parse(readFileSync('platforms/webos/appinfo.json', 'utf8'));
    expect(appinfo.requiredACG).toEqual([]);
  });
});
