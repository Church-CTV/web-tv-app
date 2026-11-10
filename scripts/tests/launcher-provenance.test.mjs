import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(path);
const hash = (data) => createHash('sha256').update(data).digest('hex');
const launcherAssets = [
  ['webos', 'icon', 80, '84f027b80e5b348202aa2c791666f96e4bd6e4b2e0f4eaa043fa93eb62c079dc'],
  ['webos', 'largeIcon', 130, '7cd6669153820f3faff797cd093d2952db5b28c741bfc486421eda62bd7c8248'],
  ['vizio', '120', 120, '40c38e1efd4ef169c28800bd3dba38d0787f903d386edcf79d5055ff15d2f43e'],
];

describe('Generated generic launcher assets (legacy metadata filenames)', () => {
  it('uses the exact pinned generic launcher for Tizen', () => {
    const icon = read('assets/launcher/roku.png');
    expect(hash(icon)).toBe('896077623700172c45fa32e35fcab7e32546a6ac36560c7069b4c1b61d5212e6');
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
