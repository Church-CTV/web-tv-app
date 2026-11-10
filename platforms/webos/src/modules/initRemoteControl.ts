/**
 * Remote control initialization module.
 * Creates the D-pad remote control adapter with key event handlers.
 */

import { createRemoteControl as createRemoteControlAdapter } from '../Adapter/RemoteControl';

export interface RemoteControlEvents {
  onBack: () => void;
  onEnter: () => void;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onExit: () => void;
}

export function createRemoteControl(events: RemoteControlEvents) {
  return createRemoteControlAdapter({
    onBack: events.onBack,
    onEnter: events.onEnter,
    onUp: events.onUp,
    onDown: events.onDown,
    onLeft: events.onLeft,
    onRight: events.onRight,
    onExit: events.onExit,
  });
}
