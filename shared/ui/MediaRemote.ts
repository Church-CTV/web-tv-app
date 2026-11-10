interface MediaPlayer {
  resume(): void;
  pause(): void;
  isPlaying(): boolean;
  seek(position: number): void;
  getPosition(): number;
  getDuration(): number;
}

export function toggleFocusedVideo(player: MediaPlayer | null, active: boolean): boolean {
  if (!active || !player || !(document.activeElement instanceof HTMLVideoElement)) return false;
  if (player.isPlaying()) player.pause();
  else player.resume();
  return true;
}

export function bindMediaRemote<Remote extends { destroy(): void }>(
  remote: Remote,
  getPlayer: () => MediaPlayer | null,
  isActive: () => boolean,
  stop: () => void
): Remote {
  const codes: Record<number, string> = {
    10252: 'MediaPlayPause',
    179: 'MediaPlayPause',
    415: 'MediaPlay',
    19: 'MediaPause',
    413: 'MediaStop',
    178: 'MediaStop',
    417: 'MediaFastForward',
    412: 'MediaRewind',
  };
  const keys = [
    'MediaPlayPause',
    'MediaPlay',
    'MediaPause',
    'MediaStop',
    'MediaFastForward',
    'MediaRewind',
  ];
  const listener = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || !isActive()) return;
    const key = keys.includes(event.key) ? event.key : codes[event.keyCode];
    const player = getPlayer();
    if (!key || !player) return;
    event.preventDefault();
    if (event.repeat) return;
    if (key === 'MediaStop') stop();
    else if (key === 'MediaPlay') player.resume();
    else if (key === 'MediaPause') player.pause();
    else if (key === 'MediaPlayPause') {
      if (player.isPlaying()) player.pause();
      else player.resume();
    } else {
      const duration = player.getDuration();
      const position = player.getPosition();
      if (Number.isFinite(duration) && duration > 0 && Number.isFinite(position)) {
        player.seek(
          Math.max(0, Math.min(duration, position + (key === 'MediaFastForward' ? 10 : -10)))
        );
      }
    }
  };
  document.addEventListener('keydown', listener);
  const destroy = remote.destroy.bind(remote);
  return {
    ...remote,
    destroy: () => {
      document.removeEventListener('keydown', listener);
      destroy();
    },
  };
}
