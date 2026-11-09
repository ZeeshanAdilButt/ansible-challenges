// Challenge 2, part 2 test.
// Run: node --test challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/test.mjs
// It fails until you have added the two tasks and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/run.mjs';

test('site.yml has the nginx test task and the debug task (seven tasks)', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c2.p2.playbook_file') ?? 'challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/site.yml';
  const r = ansible(['ansible-playbook', rel, '--list-tasks']);
  assert.equal(r.code, 0, `Ansible could not read ${rel}. Is the fleet running? node toolkit/fleet.mjs up\n${r.stdout}`);
  const tasks = r.stdout.split('\n').filter((l) => /^ {6}\S/.test(l));
  assert.ok(tasks.length >= 7, `site.yml has ${tasks.length} task(s), it needs 7. Add "Test the nginx configuration" and "Show the test result" (see the TODO lines).`);
});

test('check mode on empty servers fails at the service task', () => {
  assert.equal(getFact('c2.p2.fresh_check_failed_hosts'), 2, `Check mode on empty web hosts should fail on both (2). ${hint}`);
  assert.equal(getFact('c2.p2.fresh_check_service_error'), true, `The error should be "Could not find the requested service nginx". ${hint}`);
});

test('check mode found the drift and changed nothing', () => {
  assert.equal(getFact('c2.p2.baseline_changed_run2'), 0, `Before the drift the playbook must be stable (0 changes). ${hint}`);
  assert.equal(getFact('c2.p2.drift_check_changed'), 1, `c2.p2.drift_check_changed should be 1 (the page on web1). ${hint}`);
  assert.equal(getFact('c2.p2.diff_removed'), 'Edited by hand', `The diff should show the hand edit as the removed line. ${hint}`);
  assert.equal(getFact('c2.p2.diff_added'), 'Hello from web1', `The diff should show the playbook's text as the added line. ${hint}`);
  assert.equal(getFact('c2.p2.page_after_check'), 'Edited by hand', `After check mode the page must still hold the hand edit. ${hint}`);
});

test('the command task is skipped in check mode and runs in the real run', () => {
  assert.equal(getFact('c2.p2.drift_check_skipped'), 2, `The nginx test command should be skipped on both web hosts (2). Did you add it? ${hint}`);
  assert.equal(getFact('c2.p2.drift_check_empty_debug'), 2, `In check mode the debug task should print an empty list on both hosts (2). ${hint}`);
  assert.equal(getFact('c2.p2.apply_test_task_ok'), true, `In the real run the nginx test task should say ok. Did you add changed_when: false? ${hint}`);
});

test('the real run repaired the page and the next run changed nothing', () => {
  assert.equal(getFact('c2.p2.drift_apply_changed'), 1, `c2.p2.drift_apply_changed should be 1. ${hint}`);
  assert.equal(getFact('c2.p2.page_after_apply'), 'Hello from web1', `After the real run the page should say what the playbook says. ${hint}`);
  assert.equal(getFact('c2.p2.after_changed'), 0, `c2.p2.after_changed should be 0. If it is not, one of your tasks reports changed every time. ${hint}`);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(2), { containers: 0, networks: 0, volumes: 0 });
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
