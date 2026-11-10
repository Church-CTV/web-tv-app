/**
 * Tests for the external-command wrapper behind the reproducibility gate.
 *
 * The wrapper exists for one property: when a child fails, the message must carry the child's
 * own explanation plus how it died. `execFileSync` alone prints `Command failed: <argv>`, which
 * is why a broken packager used to look identical in CI whether it was a missing binary, a
 * refused container member or a failed internal check. These tests drive real processes so the
 * asserted message is what an operator would actually read.
 */
import { describe, expect, it } from 'vitest';
import { runStep } from './run-step.mjs';

describe('runStep', () => {
  it('returns the captured stdout of a successful command', () => {
    expect(runStep('probe', 'sh', ['-c', 'printf built']).toString()).toBe('built');
  });

  it('carries the child stderr and its exit status into the error', () => {
    let thrown = null;
    try {
      runStep('pack webOS .ipk pass 1', 'sh', [
        '-c',
        'echo "package.sh: ares-package not found" >&2; exit 127',
      ]);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown.message).toContain('pack webOS .ipk pass 1: sh -c');
    expect(thrown.message).toContain('failed (exit 127)');
    expect(thrown.message).toContain('ares-package not found');
    // The original error stays reachable so a caller can still inspect status or signal.
    expect(thrown.cause).not.toBeNull();
  });

  it('falls back to stdout when the child reports there instead', () => {
    expect(() => runStep('probe', 'sh', ['-c', 'echo complained; exit 2'])).toThrow(
      /probe: sh -c .* failed \(exit 2\)\n {2}stdout: complained/
    );
  });

  it('names a signal when the process never reported an exit status', () => {
    expect(() => runStep('probe', 'sh', ['-c', 'kill -TERM $$'])).toThrow(
      /failed \(signal SIGTERM\)/
    );
  });

  it('names the spawn failure when the command itself does not exist', () => {
    expect(() => runStep('probe', 'definitely-not-a-command', [])).toThrow(
      /probe: definitely-not-a-command failed \(ENOENT\)/
    );
  });
});
