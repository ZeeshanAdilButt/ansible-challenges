// Reads RUNBOOK.md. Each entry under "## Entries" starts with "### <title>" and has these fields:
//   - **Symptom:** ...      what a person sees
//   - **Check:** ...        the commands to run, in backticks
//   - **Cause:** ...        what is really wrong
//   - **Fix:** ...          what to do now
//   - **Prevention:** ...   what stops it next time
//   - **Measured:** ...     the number from your own run
// There must be two entries: the rollout that stopped, and the site that returns 502.
//   The rollout entry says how many hosts changed before the stop:  **Measured:** 1 host
//   The 502 entry says how long the recovery took:                  **Measured:** 48 s

const KINDS = [
  { key: 'stop', re: /rollout|stopp|batch/i, unit: 'hosts' },
  { key: 'recover', re: /502|proxy|site|health|down|recover/i, unit: 's' },
];
const FIELDS = ['Symptom', 'Check', 'Cause', 'Fix', 'Prevention'];
const words = (s) => (s.match(/[A-Za-z0-9`]+/g) ?? []).length;

function field(block, name) {
  const m = new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*[-*]\\s+\\*\\*[A-Za-z]+:\\*\\*|\\n###|$)`).exec(block);
  return m ? m[1].trim() : '';
}

/** measured: { stop: hosts changed before the stop, recover: seconds }. Returns { entries, complete, numbersMatch, report }. */
export function parseRunbook(text, measured) {
  const section = text.split(/^## Entries\s*$/m)[1] ?? '';
  const blocks = section.split(/^### /m).slice(1);
  const used = new Set();
  const entries = [];
  for (const block of blocks) {
    const title = block.split('\n')[0].trim();
    const kind = KINDS.find((k) => !used.has(k.key) && k.re.test(title));
    if (!kind) continue;
    used.add(kind.key);
    const values = Object.fromEntries(FIELDS.map((n) => [n, field(block, n)]));
    const missing = FIELDS.filter((n) => words(values[n]) < 4);
    if (!/`[^`]+`/.test(values.Check)) missing.push('Check (needs a command in backticks)');
    let number = NaN;
    if (kind.key === 'stop') {
      const m = /\*\*Measured:\*\*\s*(\d+)\s*hosts?\b/i.exec(block);
      number = m ? Number(m[1]) : NaN;
    } else {
      const m = /\*\*Measured:\*\*\s*([\d.]+)\s*(s|sec|seconds?|min|minutes?)\b/i.exec(block);
      number = m ? Number(m[1]) * (/^min/i.test(m[2]) ? 60 : 1) : NaN;
    }
    if (Number.isNaN(number)) missing.push(kind.key === 'stop' ? 'Measured (needs a number and the word host, for example "1 host")' : 'Measured (needs a number and the unit s)');
    const want = measured[kind.key];
    const matches = !Number.isNaN(number) && typeof want === 'number' && (kind.key === 'stop' ? number === want : Math.abs(number - want) <= Math.max(15, 0.5 * want));
    entries.push({ kind: kind.key, title, missing, number, want, matches, complete: missing.length === 0 });
  }
  const complete = entries.filter((e) => e.complete).length;
  const numbersMatch = KINDS.every((k) => entries.find((e) => e.kind === k.key)?.matches);
  const report = entries.map((e) => `${e.kind.padEnd(8)} "${e.title.slice(0, 40)}"  ${e.complete ? 'complete' : `missing: ${e.missing.join(', ')}`}   measured ${Number.isNaN(e.number) ? '-' : e.number} ${e.kind === 'stop' ? 'hosts' : 's'}, run ${e.want}${e.matches ? '' : '  (does not match)'}`);
  for (const k of KINDS) if (!used.has(k.key)) report.push(`${k.key.padEnd(8)} no entry found`);
  return { entries, complete, numbersMatch, report };
}
