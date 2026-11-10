export interface DecisionState {
  screen: string;
  row: number;
  column: number;
  loading: boolean;
  playing: boolean;
}

interface ChoiceAnswer {
  type: string;
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export function validateDecision(response: unknown, allowed: string[]): string {
  const body = response as { model?: string; answers?: { next_action?: ChoiceAnswer } };
  const answer = body?.answers?.next_action;
  if (
    body?.model !== 'clef-flash' ||
    answer?.type !== 'choice' ||
    !allowed.includes(answer.choice) ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1 ||
    !answer.probabilities ||
    !(answer.choice in answer.probabilities)
  ) {
    throw new Error('Invalid native decision response');
  }
  const entries = Object.entries(answer.probabilities);
  if (
    entries.some(
      ([key, value]) => !allowed.includes(key) || !Number.isFinite(value) || value < 0 || value > 1
    ) ||
    Math.abs(entries.reduce((sum, [, value]) => sum + value, 0) - 1) > 0.01 ||
    entries.some(([, value]) => value > answer.probabilities[answer.choice] + 0.0001)
  ) {
    throw new Error('Invalid native decision probabilities');
  }
  return answer.choice;
}

export function isFresh(before: DecisionState, after: DecisionState): boolean {
  return ['screen', 'row', 'column', 'loading', 'playing'].every(
    (key) => before[key as keyof DecisionState] === after[key as keyof DecisionState]
  );
}
