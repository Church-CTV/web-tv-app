import { describe, expect, it } from 'vitest';
import { renderSettingsScreen as tizen } from '../../src/ui/SettingsScreen';
import { renderSettingsScreen as vizio } from '../../../vizio/src/ui/SettingsScreen';
import { renderSettingsScreen as webos } from '../../../webos/src/ui/SettingsScreen';

describe('premium Settings surface', () => {
  for (const [platform, render] of [
    [
      'tizen',
      () => {
        const host = document.createElement('div');
        host.innerHTML = tizen();
        return host.firstElementChild!;
      },
    ],
    [
      'vizio',
      () => {
        const host = document.createElement('div');
        host.innerHTML = vizio();
        return host.firstElementChild!;
      },
    ],
    ['webos', () => webos({ channelName: 'Example', version: '1.2.3' })],
  ] as const) {
    it(`${platform} keeps metadata replaceable and gives clear scanning guidance`, () => {
      const screen = render();
      const channel = screen.querySelector('.settings-channel')!;
      expect(channel.querySelectorAll(':scope > p')).toHaveLength(2);
      expect(channel.parentElement?.querySelector('.settings-channel__heading')?.textContent).toBe(
        'Channel information'
      );
      channel.innerHTML = '<p>Channel: Updated</p><p>Version: 2.0</p>';
      expect(screen.querySelector('.settings-channel__heading')?.textContent).toBe(
        'Channel information'
      );
      expect(screen.querySelector('.settings-give__link')).toBeNull();
      expect(screen.querySelector('.settings-give__qr')).toBeNull();
    });
  }
});
