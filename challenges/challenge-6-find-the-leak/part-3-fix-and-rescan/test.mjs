// Challenge 6, part 3 test.
// Run: node --test challenges/challenge-6-find-the-leak/part-3-fix-and-rescan/test.mjs
// It fails until fixed.yml no longer leaks and you have run run.mjs. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { repoRoot, SECRET_NEW, SECRET_OLD } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-6-find-the-leak/part-3-fix-and-rescan';
const hint = `Run: node ${PART}/run.mjs`;
const fixedRel = getFact('c6.p3.fixed_file') ?? `${PART}/fixed.yml`;
const fixed = () => readFileSync(join(repoRoot, fixedRel), 'utf8');

test('fixed.yml has no debug task, hides the other results and keeps the vault', () => {
  const text = fixed();
  assert.ok(!/ansible\.builtin\.debug/.test(text), 'TODO 1: the debug task that prints the secret is still in fixed.yml. Remove it.');
  assert.ok((text.match(/no_log:\s*true/g) ?? []).length >= 3, 'TODO 2 and 3: put no_log: true on the tasks that handle the secret (the loop, the read back, the job).');
  assert.match(text, /loop_control:\s*\n\s+label:/, 'TODO 2: give the loop a label with loop_control.');
  assert.match(text, /vars_files:\s*\n\s+- vars\/secrets\.yml/, 'Keep the vault: the secret must still come from vars/secrets.yml.');
  assert.ok(!text.includes(SECRET_OLD) && !text.includes(SECRET_NEW), 'A secret value is written into the playbook. It must stay in the vault.');
});

test('the rescan finds no leak after the fix', () => {
  const before = getFact('c6.p3.leaks_before');
  assert.ok(before > 0, `c6.p3.leaks_before is missing. ${hint}`);
  const after = getFact('c6.p3.leaks_after');
  assert.equal(after, 0, `The rescan still found ${after} lines that show the secret. Look at the TODO comments in fixed.yml and at fixed-output.txt. ${hint}`);
  assert.equal(before, 12, 'Before the fix the same scan finds 12 lines (it is the part 2 playbook).');
});

test('the old secret is still in git history, so the secret was rotated', () => {
  assert.equal(getFact('c6.p3.old_secret_history_lines'), 2);
  assert.equal(getFact('c6.p3.leaks_after_old_secret_in_output'), 0);
});

test('the real run recorded what no_log does and does not hide', () => {
  assert.equal(typeof getFact('c6.p3.debug_leak'), 'boolean', `c6.p3.debug_leak is missing. ${hint}`);
  assert.equal(getFact('c6.p3.no_log_v_lines'), 0, 'no_log hides the result of a task under -v.');
  assert.equal(getFact('c6.p3.diff_lines_without_no_log'), 1, '--diff prints the content of a file without no_log.');
  assert.equal(getFact('c6.p3.diff_lines_with_no_log'), 0, 'no_log hides the --diff text.');
  assert.ok(getFact('c6.p3.error_text_leak_lines') > 0, 'In 2.21.6 the [ERROR] block of a failed action plugin can show the secret although no_log is on.');
  assert.equal(getFact('c6.p3.label_only_lines_v'), 2, 'A label alone does not hide the item under -v.');
  assert.equal(getFact('c6.p3.label_only_lines_plain'), 0);
});

test('the secret in the file on the target is readable by root and nobody else', () => {
  assert.equal(getFact('c6.p3.target_file_has_secret'), true);
  assert.equal(getFact('c6.p3.target_file_denied_other_user'), true);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(6), { containers: 0, networks: 0, volumes: 0 });
});

test('the README links the safety rules', () => {
  assert.match(readFileSync(join(here, 'README.md'), 'utf8'), /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
});

test('results.md and chart.svg exist after a recorded run', () => {
  assert.ok(existsSync(join(here, 'results.md')), 'Run run.mjs with --record to write results.md');
  const svg = readFileSync(join(here, 'chart.svg'), 'utf8');
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="t">/);
  assert.match(svg, /<desc id="d">/);
});
