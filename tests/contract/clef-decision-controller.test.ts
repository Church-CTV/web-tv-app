import { describe, expect, it } from 'vitest';
import { validateDecision, isFresh } from '../e2e/decision/controller';

const response = (choice: string, probabilities = { wait: 1 }) => ({
  model: 'clef-flash',
  answers: { next_action: { type: 'choice', choice, confidence: 1, probabilities } },
});

describe('bounded decision execution contract', () => {
  it('rejects invalid decisions instead of repairing or executing them', () => {
    expect(validateDecision(response('wait'), ['wait', 'stop'])).toBe('wait');
    for (const bad of [
      response('delete'),
      response('stop'),
      response('wait', { wait: Number.NaN }),
      { ...response('wait'), model: 'different-model' },
    ]) {
      expect(() => validateDecision(bad, ['wait', 'stop'])).toThrow();
    }
  });

  it('rejects actions when focus or app state changed during inference', () => {
    const before = { screen: 'home', row: 0, column: 0, loading: false, playing: false };
    expect(isFresh(before, { ...before })).toBe(true);
    for (const changed of [
      { ...before, row: 1 },
      { ...before, column: 1 },
      { ...before, loading: true },
      { ...before, screen: 'video', playing: true },
    ]) {
      expect(isFresh(before, changed)).toBe(false);
    }
  });
});
