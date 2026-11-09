// Challenge 6, part 2 test.
// Run: node --test challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks/test.mjs
// It fails until you have filled my-hunt.txt with the right counts and run run.mjs. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { repoRoot } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-6-find-the-leak/part-2-hunt-the-leaks';
const hint = `Run: node ${PART}/run.mjs`;
const huntRel = getFact('c6.p2.hunt_file') ?? `${PART}/my-hunt.txt`;

test('my-hunt.txt holds a number for every place', () => {
  const text = readFileSync(join(repoRoot, huntRel), 'utf8');
  for (const key of ['debug', 'loop', 'registered', 'process_list', 'git_history']) {
    assert.match(text, new RegExp(`^${key}=\\d+\\s*$`, 'm'), `${huntRel}: write a number after "${key}=". Count the lines that show the secret (see the README). ${hint}`);
  }
});

test('run.mjs found the leaks and your counts match the scanner', () => {
  assert.ok(getFact('c6.p2.leaks_total') > 0, `c6.p2.leaks_total is missing. ${hint}`);
  assert.equal(getFact('c6.p2.my_hunt_correct'), true, `Your counts in my-hunt.txt do not match the scanner. ${hint} and read what it prints.`);
});

test('the leaks are where the playbook puts them', () => {
  assert.equal(getFact('c6.p2.leaks_debug'), 2, 'The debug task prints the secret once per host (2 hosts).');
  assert.equal(getFact('c6.p2.leaks_loop'), 4, 'The loop prints one line per item per host (2 items x 2 hosts).');
  assert.equal(getFact('c6.p2.leaks_registered'), 2, 'The registered result shows under -v, once per host.');
  assert.equal(getFact('c6.p2.leaks_process_list'), 2, 'The command line shows in the process list of both hosts.');
  assert.equal(getFact('c6.p2.leaks_git_history'), 2, 'git log -p shows the secret where it was added and where it was removed.');
  assert.equal(getFact('c6.p2.leaks_git_files_now'), 0, 'The file was deleted, so no file in the repository holds the secret now.');
  assert.equal(getFact('c6.p2.leaks_total'), 12);
});

test('the copy task did not leak (the content argument is hidden by Ansible)', () => {
  assert.equal(getFact('c6.p2.copy_task_leaked'), 0);
});

test('the secret in the vault file is not plain text', () => {
  const file = join(here, 'vars', 'secrets.yml');
  assert.ok(existsSync(file), `vars/secrets.yml is made by run.mjs. ${hint}`);
  assert.ok(readFileSync(file, 'utf8').startsWith('$ANSIBLE_VAULT;'));
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
