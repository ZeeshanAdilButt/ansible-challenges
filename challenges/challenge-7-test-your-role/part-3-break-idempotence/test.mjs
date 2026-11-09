// Challenge 7, part 3 test.
// Run: node --test challenges/challenge-7-test-your-role/part-3-break-idempotence/test.mjs
// It fails until your role has the check task with changed_when: false and you have run run.mjs. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-7-test-your-role/part-3-break-idempotence';
const hint = `Run: node ${PART}/run.mjs`;

test('your role has the check task, and it says changed_when: false', () => {
  const text = readFileSync(join(here, 'roles', 'webserver', 'tasks', 'main.yml'), 'utf8');
  const ok = /Check the nginx config/.test(text) && /changed_when:\s*false/.test(text);
  // After a maintainer run with --reference the file is put back, so also accept the recorded result.
  assert.ok(ok || getFact('c7.p3.fixed_exit_code') === 0, `Add the task "Check the nginx config" (ansible.builtin.command: nginx -t) with changed_when: false to roles/webserver/tasks/main.yml. See the README, steps 2 and 4.`);
});

test('the broken role failed the idempotence step on exactly one task', () => {
  assert.equal(getFact('c7.p3.idempotence_failed_tasks_before'), 1, `${hint}`);
  assert.notEqual(getFact('c7.p3.broken_exit_code'), 0);
  assert.match(String(getFact('c7.p3.failing_task')), /Check the nginx config/);
  assert.equal(getFact('c7.p3.verify_ran_after_failure'), false, 'Molecule stops at the first failed step: verify must not run.');
  assert.equal(getFact('c7.p3.destroy_after_failure'), true, 'Molecule still destroys the test machine after a failure.');
  assert.equal(getFact('c7.p3.broken_exit_code'), 1, 'Molecule 26.11.0 exits with code 1 when the idempotence step fails.');
  assert.equal(getFact('c7.p3.broken_recap_failed'), 0, 'The recap of the broken run says failed=0 (a quirk of Molecule 26.11.0, see NOTES.md).');
});

test('your fixed role passes the whole molecule test', () => {
  assert.equal(getFact('c7.p3.idempotence_failed_tasks_after'), 0, `Your role still fails the idempotence step. ${hint}`);
  assert.equal(getFact('c7.p3.fixed_exit_code'), 0, `molecule test failed for your role. ${hint}`);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(7), { containers: 0, networks: 0, volumes: 0 });
});

test('the README links the safety rules and names the Docker socket exception', () => {
  const text = readFileSync(join(here, 'README.md'), 'utf8');
  assert.match(text, /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
  assert.match(text, /docker\.sock/);
});

test('results.md and chart.svg exist after a recorded run', () => {
  assert.ok(existsSync(join(here, 'results.md')), 'Run run.mjs with --record to write results.md');
  const svg = readFileSync(join(here, 'chart.svg'), 'utf8');
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="t">/);
  assert.match(svg, /<desc id="d">/);
});
