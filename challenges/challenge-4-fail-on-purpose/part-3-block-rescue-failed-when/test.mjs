// Challenge 4, part 3 test.
// Run: node --test challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when/test.mjs
// It fails until you have done the three TODOs (ignore.yml, block-rescue.yml, failed-when.yml) and run run.mjs once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-4-fail-on-purpose/part-3-block-rescue-failed-when';
const hint = `Run: node ${PART}/run.mjs`;

// Your files hold the code. Comments do not count.
const code = (name) =>
  readFileSync(join(here, getFact('c4.p3.files_folder') ?? '.', name), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

test('ignore.yml, block-rescue.yml and failed-when.yml use the right keywords', () => {
  assert.match(code('ignore.yml'), /^\s+ignore_errors:\s*(true|yes)\s*$/m, 'ignore.yml: add ignore_errors: true to the task that reads the version.');
  const br = code('block-rescue.yml');
  assert.match(br, /^\s+block:\s*$/m, 'block-rescue.yml: put the tasks in a block:.');
  assert.match(br, /^\s+rescue:\s*$/m, 'block-rescue.yml: add a rescue: section.');
  assert.match(br, /^\s+always:\s*$/m, 'block-rescue.yml: add an always: section.');
  assert.match(code('failed-when.yml'), /^\s+failed_when:\s*.*2\.4\.1.*$/m, 'failed-when.yml: add failed_when with a test for 2.4.1 in the output.');
});

test('plain: db1 fails and drops out, the other two reach the last task', () => {
  assert.equal(getFact('c4.p3.plain_exit_code'), 2, `A failed host makes ansible-playbook exit with 2. ${hint}`);
  assert.equal(getFact('c4.p3.plain_failed'), 1, `One host (db1) should fail. ${hint}`);
  assert.equal(getFact('c4.p3.plain_ok'), 4, `ok should be 4 (2 tasks on web1 and web2). ${hint}`);
  assert.equal(getFact('c4.p3.plain_announce_hosts'), 2, `The last task should run on 2 hosts. ${hint}`);
});

test('ignore_errors: nothing is failed, the exit code is 0, and db1 goes on as if nothing happened', () => {
  assert.equal(getFact('c4.p3.ignore_exit_code'), 0, `${hint}`);
  assert.equal(getFact('c4.p3.ignore_failed'), 0, `${hint}`);
  assert.equal(getFact('c4.p3.ignore_ignored'), 1, `${hint}`);
  assert.equal(getFact('c4.p3.ignore_ok'), 6, `An ignored task counts as ok too: 6 in total. ${hint}`);
  assert.equal(getFact('c4.p3.ignore_announce_hosts'), 3, `db1 reaches the last task, although its version file is missing. ${hint}`);
});

test('block and rescue: db1 is rescued, the exit code is 0, db1 skips the rest of the block', () => {
  assert.equal(getFact('c4.p3.rescue_exit_code'), 0, `${hint}`);
  assert.equal(getFact('c4.p3.rescue_failed'), 0, `${hint}`);
  assert.equal(getFact('c4.p3.rescue_rescued'), 1, `${hint}`);
  assert.equal(getFact('c4.p3.rescue_changed'), 4, `4 changes: the always task on 3 hosts, the rescue task on db1. ${hint}`);
  assert.equal(getFact('c4.p3.rescue_announce_hosts'), 2, `The last task of the block runs on web1 and web2 only. ${hint}`);
  assert.equal(getFact('c4.p3.marker_written'), true, `The rescue task should have written /tmp/needs-deploy on db1. ${hint}`);
});

test('failed_when: a command that worked can still be a failure', () => {
  assert.equal(getFact('c4.p3.failedwhen_exit_code'), 2, `${hint}`);
  assert.equal(getFact('c4.p3.failedwhen_failed'), 2, `web2 (wrong version) and db1 (no file) should fail. ${hint}`);
  assert.equal(getFact('c4.p3.failedwhen_announce_hosts'), 1, `Only web1 reaches the last task. ${hint}`);
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
