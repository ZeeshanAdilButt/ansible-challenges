// Checks of DEFENCE.md. Plain text rules, no AI: a mentor still reads the words.
// What these rules can tell: the shape is right, the length is right, the numbers are your own, and each answer touches
// the ideas the question is about. They cannot tell whether the answer is good. That is the mentor's job.

import { getFact } from '../../../toolkit/facts.js';

export const SECTIONS = ['The fleet', 'The pipeline', 'The rollout', 'The failure and the recovery', 'At ten times the fleet'];

// Lines that only hold a template prompt, such as "(seconds per stage ...)", and the quoted questions (> ...) are not words of the learner.
const stripPrompts = (s) => s.split(/\r?\n/).filter((l) => !/^\s*\(.*\)\s*$/.test(l) && !/^\s*>/.test(l)).join('\n');
const words = (s) => (s.match(/[A-Za-z0-9][A-Za-z0-9'.-]*/g) ?? []).length;

const SECONDS = /^(s|secs?|seconds?)$/i;
const MINUTES = /^(min|mins|minutes?)$/i;
const HOSTS = /^hosts?$/i;
const TASKS = /^tasks?$/i;
const STAGES = /^stages?$/i;
const BATCHES = /^batch(es)?$/i;

/** The facts a defence can quote, with the unit words that may follow the number in the text, and how close it must be. */
export const QUOTABLE = [
  ['c10.p1.stage_lint_s', SECONDS, 'seconds'], ['c10.p1.stage_apply_s', SECONDS, 'seconds'], ['c10.p1.stage_idempotence_s', SECONDS, 'seconds'],
  ['c10.p1.stage_check_s', SECONDS, 'seconds'], ['c10.p1.first_run_changed_count', TASKS, 'exact'], ['c10.p1.stages_total_count', STAGES, 'exact'],
  ['c10.p2.baseline_s', SECONDS, 'seconds'], ['c10.p2.good_s', SECONDS, 'seconds'], ['c10.p2.bad_s', SECONDS, 'seconds'],
  ['c10.p2.good_batches_count', BATCHES, 'exact'], ['c10.p2.bad_changed_before_stop_count', HOSTS, 'exact'], ['c10.p2.bad_untouched_count', HOSTS, 'exact'],
  ['c10.p3.recover_s', SECONDS, 'seconds'], ['c10.p3.recover_min', MINUTES, 'minutes'],
];

const QUESTION_ONE = /^##\s+Question 1\b/im;

export function checkDefence(text) {
  const demo = text.split(QUESTION_ONE)[0];
  const sections = SECTIONS.filter((name) => new RegExp(`^##\\s+${name}\\s*$`, 'im').test(demo));
  const body = stripPrompts(demo.replace(/^#{1,6}\s.*$/gm, ''));
  const spoken = [...body.matchAll(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec|s|minutes?|mins?|min|hosts?|tasks?|stages?|batch(?:es)?)\b/gi)].map((m) => ({ n: Number(m[1]), unit: m[2] }));
  const matched = [];
  for (const [name, unitRe, mode] of QUOTABLE) {
    const v = getFact(name);
    if (typeof v !== 'number') continue;
    const tol = mode === 'exact' ? 0 : mode === 'minutes' ? Math.max(0.05, 0.1 * v) : Math.max(0.5, 0.05 * v);
    if (spoken.some((s) => unitRe.test(s.unit) && Math.abs(s.n - v) <= tol)) matched.push(name);
  }
  return { sections: sections.length, words: words(body), matched, possible: QUOTABLE.filter(([n]) => typeof getFact(n) === 'number').length };
}

export const QUESTIONS = [
  { heading: 'Question 1', question: 'Your rollout used serial: 1. What stops it when one host fails? What would change with serial: 2, and what did you add so the rule does not depend on the batch size?', need: [/serial/i, /(any_errors_fatal|max_fail_percentage)/i, /batch/i, /(next batch|remaining|continue|continued|dropped|drops|still ran|keeps? going|rest of the|whole play|all hosts)/i], needText: 'serial and the batch, the keyword you added, and what happens to the remaining hosts without it' },
  { heading: 'Question 2', question: 'Where is the vault password, and how does CI get it without it entering the repository?', need: [/vault/i, /(\.vault-pass|password file|vault-pass\.sh|ANSIBLE_VAULT_PASSWORD_FILE|CI secret|secrets\.)/i, /(git|ignore|repository|commit)/i], needText: 'the vault, the password file or CI secret, and git' },
  { heading: 'Question 3', question: 'Your second run says changed=0. What makes a task report changed on every run, and how do you find it?', need: [/(command|shell|changed_when)/i, /(-v\b|verbose|--diff|check mode|--check|recap)/i], needText: 'command or shell or changed_when, and how you look (-v, --diff, check mode)' },
  { heading: 'Troubleshooting', question: 'The site answers 502 through the proxy. What do you check, in order?', need: [/(curl|uri|health|\/health)/i, /(service|status|log|ps\b|init)/i, /(app|web2|upstream|proxy_pass)/i], needText: 'the health route, the service status or log, and the app host behind the proxy' },
];

export function checkQuestions(text) {
  const start = text.search(QUESTION_ONE);
  const rest = start < 0 ? '' : text.slice(start);
  const chunks = rest.split(/^##\s+/m).slice(1);
  return QUESTIONS.map((p) => {
    const chunk = chunks.find((c) => c.toLowerCase().startsWith(p.heading.toLowerCase())) ?? '';
    const answer = stripPrompts(chunk.split('\n').slice(1).join('\n'));
    const count = words(answer);
    const missing = p.need.filter((re) => !re.test(answer));
    const problems = [];
    if (count < 60) problems.push(`${count} words, at least 60 needed`);
    if (count > 200) problems.push(`${count} words, at most 200`);
    if (missing.length) problems.push(`does not mention: ${p.needText}`);
    return { heading: p.heading, question: p.question, words: count, ok: problems.length === 0, problems };
  });
}
