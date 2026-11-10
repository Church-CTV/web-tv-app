/**
 * Tizen UI re-export barrels — the UI module mirrors shared/ui for backward
 * compatibility. These tests assert each barrel resolves its named exports so a
 * future removal or typo (breaking the platform UI) fails fast.
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard } from '../../src/ui/ContentCard';

describe('Tizen UI re-export barrels', () => {
  it('ContentCard barrel exposes renderContentCard', () => {
    expect(typeof renderContentCard).toBe('function');
  });
});
