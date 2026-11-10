/**
 * Vizio Remote control initialization module.
 */

export interface RemoteControlEvents {
  onBack: () => void;
  onEnter: () => void;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
}

export function createRemoteControl(events: RemoteControlEvents): void {
  // Vizio uses web keydown events
  const handler = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Backspace':
      case 'Escape':
        events.onBack();
        break;
      case 'Enter':
        events.onEnter();
        break;
      case 'ArrowUp':
        events.onUp();
        break;
      case 'ArrowDown':
        events.onDown();
        break;
      case 'ArrowLeft':
        events.onLeft();
        break;
      case 'ArrowRight':
        events.onRight();
        break;
    }
  };
  document.addEventListener('keydown', handler);
}
