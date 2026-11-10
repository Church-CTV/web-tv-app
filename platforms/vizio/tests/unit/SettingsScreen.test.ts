import { describe, it, expect } from 'vitest';
import { renderSettingsScreen } from '../../src/ui/SettingsScreen';

describe('SettingsScreen pinned Roku scope', () => {
  function render(channel = 'Example Channel') {
    document.body.innerHTML = renderSettingsScreen({
      get: (key) => (key === 'channelName' ? channel : null),
      set: () => {},
      remove: () => {},
      getAll: () => ({}),
    });
    return document.querySelector('.settings-screen')!;
  }
  it('renders the channel and giving sections', () => {
    const screen = render();
    expect(screen.querySelector('.settings-channel')?.textContent).toContain(
      'Channel: Example Channel'
    );
    expect(screen.textContent).toContain('Giving is not configured.');
  });
  it('renders the loaded channel as text', () => {
    const screen = render('<img src=x onerror=alert(1)>');
    expect(screen.querySelector('.settings-channel')?.textContent).toContain(
      '<img src=x onerror=alert(1)>'
    );
    expect(screen.querySelector('.settings-channel img')).toBeNull();
  });
  it('keeps disabled preferences out of the Roku product surface', () => {
    const screen = render();
    expect(screen.querySelectorAll('[data-setting], input, select')).toHaveLength(0);
    expect(screen.textContent).not.toMatch(/Appearance|Server URL|Clear Cache/);
  });
  it('does not offer an unconfigured giving destination', () => {
    expect(render().querySelector('.settings-give__link')).toBeNull();
  });
  it('does not display an unconfigured QR', () => {
    expect(render().querySelector('.settings-give__qr')).toBeNull();
  });
});
