import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(path);
const hash = (data) => createHash('sha256').update(data).digest('hex');
const launcherAssets = [
  ['webos', 'icon', 80, '01b99def05333afd9899a083f3659cdece382317211e8147988a5f348fb9865c'],
  ['webos', 'largeIcon', 130, '6c88bb1584b75c5fb43372e8515b3b9c674f700e81c93bf3e38c8d1258c79984'],
  ['vizio', '120', 120, 'd159db8df2d2dd95007bf442ad9cae2170c7d9bbfd926cc4161370640409de9a'],
];

describe('Roku launcher assets', () => {
  it('uses the exact pinned Roku launcher for Tizen', () => {
    const icon = read('assets/launcher/roku.png');
    expect(hash(icon)).toBe('0e97b3d81089a4bc09b9fed193deed534d6f7def90523ca27121c776c3573dd5');
    expect(read('platforms/tizen/config.xml').toString()).toContain(
      '<icon src="assets/launcher-roku.png"/>'
    );
  });

  it('references pinned platform-sized PNG adaptations', () => {
    const webos = JSON.parse(read('platforms/webos/appinfo.json'));
    const vizio = JSON.parse(read('platforms/vizio/manifest.json'));
    for (const [platform, key, size, expectedHash] of launcherAssets) {
      const path = platform === 'webos' ? webos[key] : vizio.icons[key];
      expect(path).toBe(`assets/launcher-roku-${size}.png`);
      const icon = read(`assets/launcher/roku-${size}.png`);
      expect(hash(icon)).toBe(expectedHash);
      expect(icon.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([size, size]);
      expect(icon.length).toBeGreaterThan(1024);
    }
  });
});
