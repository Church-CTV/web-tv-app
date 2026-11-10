/**
 * Run one external command, failing with the output that explains the failure.
 *
 * `execFileSync` rejects with `Command failed: <argv>` and leaves the captured child output on
 * the error object, where nothing prints it. A reproducibility-gate step that logs only that
 * line tells nobody whether the packager lost `ares-package`, hit a missing container member or
 * tripped one of its own checks - and those are the three causes this repository has actually
 * met. Every external call in `scripts/check-reproducible-packages.mjs` goes through here so the
 * failing program's own words reach the log next to its exit status or signal.
 */
import { execFileSync } from 'node:child_process';

export function runStep(label, command, args, options = {}) {
  try {
    return execFileSync(command, args, { stdio: 'pipe', ...options });
  } catch (err) {
    const how = Number.isInteger(err?.status)
      ? `exit ${err.status}`
      : err?.signal
        ? `signal ${err.signal}`
        : String(err?.code || 'no exit status');
    const output = [
      ['stderr', err?.stderr],
      ['stdout', err?.stdout],
    ]
      .map(([name, raw]) => {
        // A child that says nothing adds nothing: an empty section would only push the useful
        // lines further from the front of the log.
        const text = raw == null ? '' : String(raw).trim();
        return text === '' ? '' : `${name}: ${text}`;
      })
      .filter((part) => part !== '')
      .join('\n');
    const invoked = args.length === 0 ? command : `${command} ${args.join(' ')}`;
    throw new Error(
      `${label}: ${invoked} failed (${how})` +
        (output === '' ? '' : `\n  ${output.split('\n').join('\n  ')}`),
      { cause: err }
    );
  }
}
