/**
 * Tizen Remote control initialization module.
 */

import { createRemoteControl as createRemoteControlAdapter } from '../Adapter/RemoteControl';
import type { TizenKey } from '../Adapter/RemoteControl';

export interface RemoteControlEvents {
  onBack: () => void;
  onEnter: () => void;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
}

export function createRemoteControl(
  events: RemoteControlEvents
): ReturnType<typeof createRemoteControlAdapter> {
  const handler: (key: TizenKey) => void = (key: TizenKey) => {
    switch (key) {
      case 'enter':
        events.onEnter();
        break;
      case 'up':
        events.onUp();
        break;
      case 'down':
        events.onDown();
        break;
      case 'left':
        events.onLeft();
        break;
      case 'right':
        events.onRight();
        break;
      case 'back':
        events.onBack();
        break;
    }
  };
  return createRemoteControlAdapter(handler, events.onBack);
}
