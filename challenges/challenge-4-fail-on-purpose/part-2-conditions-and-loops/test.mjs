// Challenge 4, part 2 test.
// Run: node --test challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops/test.mjs
// It fails until you have done the four TODOs in site.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const PART = 'challenges/challenge-4-fail-on-purpose/part-2-conditions-and-loops';
const hint = `Run: node ${PART}/run.mjs`;

test('site.yml uses loop, loop_control, when on group_names, and until with retries and delay', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c4.p2.playbook_file') ?? `${PART}/site.yml`;
  const code = readFileSync(join(root, rel), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  assert.match(code, /loop:\s*"\{\{\s*common_packages\s*\}\}"/, 'TODO 1: the package task needs loop: "{{ common_packages }}".');
  assert.match(code, /loop:\s*"\{\{\s*users\s*\}\}"/, 'TODO 2: the user task needs loop: "{{ users }}".');
  assert.match(code, /loop_control:/, 'TODO 2: add loop_control with a label.');
  assert.equal((code.match(/when:\s*"'(web|db)' in group_names"/g) ?? []).length, 2, 'TODO 3: two tasks need a when on group_names (one for web, one for db).');
  assert.match(code, /until:\s*nginx_answer\.status == 200/, 'TODO 4: the wait task needs until: nginx_answer.status == 200.');
  assert.match(code, /^\s+retries:\s*\d+/m, 'TODO 4: the wait task needs retries.');
  assert.match(code, /^\s+delay:\s*\d+/m, 'TODO 4: the wait task needs delay.');
});

test('the loops ran once per item on each host', () => {
  assert.equal(getFact('c4.p2.loop_items'), 2, `The package task should run 2 times per host (tree, jq). ${hint}`);
  assert.equal(getFact('c4.p2.user_items'), 3, `The user task should run 3 times per host (alice, bob, carol). ${hint}`);
  assert.equal(getFact('c4.p2.hosts_with_all_users'), 3, `All 3 hosts should have the 3 users. ${hint}`);
});

test('conditions decided where each task ran', () => {
  assert.equal(getFact('c4.p2.nginx_hosts'), 'web1,web2', `nginx should be on web1 and web2 only. ${hint}`);
  assert.equal(getFact('c4.p2.sqlite3_hosts'), 'db1', `sqlite3 should be on db1 only. ${hint}`);
  assert.equal(getFact('c4.p2.skipped_db1'), 2, `db1 should skip 2 tasks (nginx, the Red Hat one). ${hint}`);
  assert.equal(getFact('c4.p2.skipped_web1'), 2, `web1 should skip 2 tasks (sqlite3, the Red Hat one). ${hint}`);
  assert.equal(getFact('c4.p2.skipped'), 6, `6 skipped tasks in total (2 on each host). ${hint}`);
});

test('the wait task retried, and succeeded before the retries ran out', () => {
  const used = getFact('c4.p2.retries_used');
  assert.ok(Number.isInteger(used) && used >= 1 && used <= 9, `c4.p2.retries_used should be between 1 and 9 (it depends on how fast the hosts are, about 2 to 4). It is ${used}. ${hint}`);
});

test('too few retries fails on both web hosts', () => {
  assert.equal(getFact('c4.p2.few_retries_exit_code'), 2, `A failed task makes ansible-playbook exit with 2. ${hint}`);
  assert.equal(getFact('c4.p2.few_retries_attempts'), 3, `With retries: 3 the failure message says attempts: 3. ${hint}`);
  assert.equal(getFact('c4.p2.few_retries_failed_hosts'), 2, `Both web hosts should fail. ${hint}`);
});

test('retries: 3 means one try and then three retries, and the failure message undercounts by one', () => {
  assert.equal(getFact('c4.p2.count_reported_attempts'), 3, `The failure message should say attempts: 3. ${hint}`);
  assert.equal(getFact('c4.p2.count_real_attempts'), 4, `The counter file on the host should say 4 real runs. ${hint}`);
});

test('the fleet is running', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(4), { containers: 0, networks: 0, volumes: 0 });
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
