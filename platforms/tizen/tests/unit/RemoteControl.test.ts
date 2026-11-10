/**
 * Tizen RemoteControl — unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createRemoteControl,
  createFocusManager,
  exitApplication,
} from '../../src/Adapter/RemoteControl';

describe('Tizen RemoteControl', () => {
  it.each([
    { key: 'Unidentified', keyCode: 10009 },
    { key: 'Back', keyCode: 0 },
  ])('routes the Samsung Back event to Back exactly once: %j', (init) => {
    const onBack = vi.fn();
    const onKey = vi.fn();
    const remote = createRemoteControl(onKey, onBack);
    try {
      const event = new KeyboardEvent('keydown', { ...init, cancelable: true });
      document.dispatchEvent(event);
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onKey).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    } finally {
      remote.destroy();
    }
  });

  it('creates a remote control with key handler', () => {
    let receivedKey: string | null = null;
    const handler = (key: string) => {
      receivedKey = key;
    };
    const rc = createRemoteControl(handler);
    expect(rc).toBeDefined();
    expect(rc.destroy).toBeDefined();
    rc.destroy();
  });

  it('handles up key', () => {
    let key = '';
    const rc = createRemoteControl((k) => {
      key = k;
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(key).toBe('up');
    rc.destroy();
  });

  it('handles down key', () => {
    let key = '';
    const rc = createRemoteControl((k) => {
      key = k;
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(key).toBe('down');
    rc.destroy();
  });

  it('handles enter key', () => {
    let key = '';
    const rc = createRemoteControl((k) => {
      key = k;
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    // KeyMap uses e.key which for Enter is 'Enter'
    expect(key).toBe('enter');
    rc.destroy();
  });

  it('handles escape as back', () => {
    let called = false;
    const rc = createRemoteControl(
      () => {},
      () => {
        called = true;
      }
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(called).toBe(true);
    rc.destroy();
  });

  it('destroys without error', () => {
    const rc = createRemoteControl(() => {});
    expect(() => rc.destroy()).not.toThrow();
  });

  it('handles unknown keys without error', () => {
    let key = '';
    const rc = createRemoteControl((k) => {
      key = k;
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unknown' }));
    expect(key).toBe('');
    rc.destroy();
  });
});

describe('Tizen FocusManager', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <a href="#" class="item-1">Link 1</a>
      <button class="item-2">Button 2</button>
      <div tabindex="0" class="item-3">Div 3</div>
      <input type="text" class="item-4" />
      <button disabled class="item-5">Disabled</button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('focuses first element', () => {
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.className).toBe('item-1');
  });

  it('focuses last element', () => {
    const fm = createFocusManager(container);
    fm.focusLast();
    expect(document.activeElement?.className).toBe('item-4');
  });

  it('focuses next element in sequence', () => {
    const fm = createFocusManager(container);
    fm.focusFirst();
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-2');
  });

  it('focuses previous element in sequence', () => {
    const fm = createFocusManager(container);
    fm.focusLast();
    fm.focusPrev();
    expect(document.activeElement?.className).toBe('item-3');
  });

  it('wraps focus from last to first', () => {
    const fm = createFocusManager(container);
    fm.focusLast();
    fm.focusNext();
    expect(document.activeElement?.className).toBe('item-1');
  });

  it('wraps focus from first to last', () => {
    const fm = createFocusManager(container);
    fm.focusFirst();
    fm.focusPrev();
    expect(document.activeElement?.className).toBe('item-4');
  });

  it('handles empty container', () => {
    const empty = document.createElement('div');
    document.body.appendChild(empty);
    const fm = createFocusManager(empty);
    expect(() => fm.focusFirst()).not.toThrow();
    expect(() => fm.focusNext()).not.toThrow();
    document.body.removeChild(empty);
  });
});

describe('Tizen RemoteControl key-lock teardown (releasekeyevent)', () => {
  // Store-relevant (config.xml enables hwkey-event): every registerlockevent
  // must be matched by a releasekeyevent on BOTH teardown paths, otherwise the
  // TV keeps swallowing those keys after the app exits.
  const KEYCODES = [
    'KEY_UP',
    'KEY_DOWN',
    'KEY_LEFT',
    'KEY_RIGHT',
    'KEY_ENTER',
    'KEY_BACK',
    'KEY_MENU',
  ];

  function setTizen(throwOnRelease = false): string[] {
    const released: string[] = [];
    (window as unknown as { tizen?: unknown }).tizen = {
      keys: {
        registerlockevent: () => {},
        releasekeyevent: (code: string) => {
          if (throwOnRelease) throw new Error('release rejected');
          released.push(code);
        },
      },
    };
    return released;
  }

  afterEach(() => {
    delete (window as unknown as { tizen?: unknown }).tizen;
  });

  it('releases every registered keycode exactly once on destroy', () => {
    const released = setTizen();
    const rc = createRemoteControl(() => {});
    rc.destroy();
    expect([...released].sort()).toEqual([...KEYCODES].sort());
    for (const code of KEYCODES) {
      expect(released.filter((c) => c === code)).toHaveLength(1);
    }
  });

  it('releases every registered keycode exactly once on window beforeunload', () => {
    const released = setTizen();
    createRemoteControl(() => {});
    window.dispatchEvent(new Event('beforeunload'));
    expect([...released].sort()).toEqual([...KEYCODES].sort());
    for (const code of KEYCODES) {
      expect(released.filter((c) => c === code)).toHaveLength(1);
    }
  });

  it('does not throw when a release fails', () => {
    setTizen(true);
    const rc = createRemoteControl(() => {});
    expect(() => rc.destroy()).not.toThrow();
    expect(() => window.dispatchEvent(new Event('beforeunload'))).not.toThrow();
  });
});

describe('Tizen RemoteControl lock-event callbacks (tizen.keys path)', () => {
  // Store-relevant: locked keys bypass DOM keydown entirely, so the TV
  // delivers ONLY through these registered callbacks. Both routing arms and
  // the per-key rejection tolerance must be proven.
  function withTizenKeys(throwOn?: string): Record<string, () => void> {
    const callbacks: Record<string, () => void> = {};
    (window as unknown as { tizen?: unknown }).tizen = {
      keys: {
        registerlockevent: (code: string, cb: () => void) => {
          if (throwOn === code) throw new Error('key rejected');
          callbacks[code] = cb;
        },
        releasekeyevent: () => {},
      },
    };
    return callbacks;
  }

  afterEach(() => {
    delete (window as unknown as { tizen?: unknown }).tizen;
  });

  it('routes the KEY_BACK lock callback to onBack, not the handler', () => {
    const callbacks = withTizenKeys();
    const seen: string[] = [];
    const rc = createRemoteControl(
      (k) => seen.push(k),
      () => seen.push('BACK')
    );
    callbacks.KEY_BACK();
    expect(seen).toEqual(['BACK']);
    rc.destroy();
  });

  it('routes non-back lock callbacks to the handler with the mapped key', () => {
    const callbacks = withTizenKeys();
    const seen: string[] = [];
    const rc = createRemoteControl(
      (k) => seen.push(k),
      () => seen.push('BACK')
    );
    callbacks.KEY_UP();
    callbacks.KEY_MENU();
    expect(seen).toEqual(['up', 'menu']);
    rc.destroy();
  });

  it('keeps registering the remaining keys when the runtime rejects one', () => {
    const callbacks = withTizenKeys('KEY_BACK');
    const rc = createRemoteControl(() => {});
    expect(Object.keys(callbacks).sort()).toEqual([
      'KEY_DOWN',
      'KEY_ENTER',
      'KEY_LEFT',
      'KEY_MENU',
      'KEY_RIGHT',
      'KEY_UP',
    ]);
    rc.destroy();
  });
});

describe('exitApplication', () => {
  it('invokes tizen application exit when the runtime is present', () => {
    const exitSpy = vi.fn();
    window.tizen = {
      application: { getCurrentApplication: () => ({ exit: exitSpy }) },
    };
    exitApplication();
    expect(exitSpy).toHaveBeenCalledTimes(1);
    delete window.tizen;
  });

  it('is a guarded no-op without window.tizen', () => {
    expect(() => exitApplication()).not.toThrow();
  });

  it('survives a runtime missing getCurrentApplication or exit', () => {
    window.tizen = { application: {} };
    expect(() => exitApplication()).not.toThrow();
    window.tizen = { application: { getCurrentApplication: () => undefined } };
    expect(() => exitApplication()).not.toThrow();
    delete window.tizen;
  });
});

describe('createFocusManager edge branches', () => {
  it('no-ops next/prev/first/last on an empty container', () => {
    const c = document.createElement('div');
    document.body.appendChild(c);
    const fm = createFocusManager(c);
    expect(() => {
      fm.focusNext();
      fm.focusPrev();
      fm.focusFirst();
      fm.focusLast();
    }).not.toThrow();
  });

  it('focusPrev from the first element wraps to the last', () => {
    const c = document.createElement('div');
    c.innerHTML = '<button>a</button><button>b</button><button>c</button>';
    document.body.appendChild(c);
    const fm = createFocusManager(c);
    fm.focusFirst();
    fm.focusPrev();
    expect(document.activeElement).toBe(c.querySelectorAll('button')[2]);
  });

  it('keeps its own index cursor across calls', () => {
    const c = document.createElement('div');
    c.innerHTML = '<button>a</button><button>b</button>';
    document.body.appendChild(c);
    const fm = createFocusManager(c);
    fm.focusNext();
    fm.focusNext();
    expect(document.activeElement).toBe(c.querySelectorAll('button')[0]);
  });
});
