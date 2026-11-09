// Helpers shared by the parts of challenge 7 (test your role).
// Molecule runs in its own container (toolkit/molecule.mjs), the one container that has the Docker socket.

import { moleculeExec } from '../../toolkit/molecule.mjs';

export const CHALLENGE = 7;

/** Run one molecule command in a role folder (a path inside the repository). Returns { code, stdout }. */
export function molecule(roleDir, args, opts = {}) {
  return moleculeExec(CHALLENGE, ['molecule', ...args], { cwd: roleDir, ...opts });
}

/** The SCENARIO RECAP line of a molecule run: actions, successful, disabled, skipped, missing, failed. */
export function parseRecap(text) {
  const m = text.match(/default\s*: actions=(\d+)\s+successful=(\d+)\s+disabled=(\d+)\s+skipped=(\d+)\s+missing=(\d+)\s+failed=(\d+)/);
  if (!m) return null;
  const [actions, successful, disabled, skipped, missing, failed] = m.slice(1).map(Number);
  return { actions, successful, disabled, skipped, missing, failed };
}

/** The part of a molecule run that belongs to one step, for example "verify". */
export function stepOutput(text, step) {
  const start = text.indexOf(`[default > ${step}] Executing`);
  if (start < 0) return '';
  const rest = text.slice(start + 10);
  const next = rest.search(/INFO\s+\[default > \w+\] Executing/);
  return next < 0 ? rest : rest.slice(0, next);
}

/** How many assert tasks passed in the verify step: each prints one block "ok: [host] => {". */
export function countPassedAsserts(text) {
  return stepOutput(text, 'verify').split(/\r?\n/).filter((l) => /^ok: \[[^\]]+\] => \{/.test(l)).length;
}

/** Seconds as a number with one decimal. */
export const secondsSince = (t0) => Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10;
