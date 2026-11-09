// Challenge 2, part 1 test.
// Run: node --test challenges/challenge-2-run-it-twice/part-1-first-playbook/test.mjs
// It fails until you have written your playbook and run run.mjs once. That is on purpose.
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
const hint = 'Run: node challenges/challenge-2-run-it-twice/part-1-first-playbook/run.mjs';

test('site.yml is a valid playbook with five tasks', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c2.p1.playbook_file') ?? 'challenges/challenge-2-run-it-twice/part-1-first-playbook/site.yml';
  const r = ansible(['ansible-playbook', rel, '--list-tasks']);
  assert.equal(r.code, 0, `Ansible could not read ${rel}. Is the fleet running? node toolkit/fleet.mjs up\n${r.stdout}`);
  const tasks = r.stdout.split('\n').filter((l) => /^ {6}\S/.test(l));
  assert.ok(tasks.length >= 5, `site.yml has ${tasks.length} task(s), it needs 5 (nginx: install, page, start; redis: install, start). Follow the TODO lines in site.yml.`);
});

test('the first run changed things and the second run changed nothing', () => {
  assert.equal(getFact('c2.p1.tasks'), 5, `c2.p1.tasks should be 5. ${hint}`);
  assert.equal(getFact('c2.p1.failed_run1'), 0, `The first run had failed tasks. Read the run output. ${hint}`);
  assert.equal(getFact('c2.p1.changed_run1'), 8, `c2.p1.changed_run1 should be 8 (3 on web1, 3 on web2, 2 on db1). ${hint}`);
  assert.equal(getFact('c2.p1.changed_run2'), 0, `c2.p1.changed_run2 should be 0: a second run of a good playbook changes nothing. ${hint}`);
});

test('nginx and redis really work on the servers', () => {
  assert.equal(getFact('c2.p1.web_status_200_count'), 2, `Both web hosts should answer with status 200. Is nginx started? ${hint}`);
  assert.equal(getFact('c2.p1.redis_pong'), true, `redis-cli ping on db1 should answer PONG. Is redis-server started? ${hint}`);
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
