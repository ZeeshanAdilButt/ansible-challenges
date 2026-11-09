// Challenge 3, part 1 test.
// Run: node --test challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/test.mjs
// It fails until you have written my-guess.txt and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { SOURCES } from './ladder.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/run.mjs';
const NAMES = ['role-defaults', 'group_vars-all', 'group_vars-web', 'host_vars-web2', 'play-vars', 'extra-vars'];

test('my-guess.txt lists the six places, each once', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c3.p1.guess_file') ?? 'challenges/challenge-3-one-template-three-hosts/part-1-precedence-ladder/my-guess.txt';
  const file = join(here, '..', '..', '..', rel);
  const lines = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.deepEqual([...lines].sort(), [...NAMES].sort(), `my-guess.txt must hold these six names, each once: ${NAMES.join(', ')}. Write your guess, weakest first (see the TODO).`);
});

test('the run tested every place in the documentation list', () => {
  assert.equal(getFact('c3.p1.sources_tested'), SOURCES.length, `c3.p1.sources_tested should be ${SOURCES.length}. ${hint}`);
});

test('the winners follow the ladder on web2 and web1', () => {
  const ids = SOURCES.map((s) => s.id);
  assert.equal(getFact('c3.p1.winners_web2'), ids.join(','), `On web2 every new place should win as it is added. ${hint}`);
  // web1 is not touched by the places that only name web2: the winner stays the same for those steps.
  const web1 = [];
  for (const [i, s] of SOURCES.entries()) web1.push(s.hosts && !s.hosts.includes('web1') ? web1[i - 1] : s.id);
  assert.equal(getFact('c3.p1.winners_web1'), web1.join(','), `On web1 the three places that name web2 must not win. ${hint}`);
  assert.equal(getFact('c3.p1.docs_mismatches'), 0, `The real order should match the documentation order. ${hint}`);
});

test('the six core places come out in the documented order', () => {
  assert.equal(getFact('c3.p1.core_order'), NAMES.join(','), `Measured order of the six places, weakest first, should be ${NAMES.join(', ')}. ${hint}`);
  const pairs = getFact('c3.p1.guess_pairs_right');
  assert.ok(Number.isInteger(pairs) && pairs >= 0 && pairs <= 15, `c3.p1.guess_pairs_right should be a number from 0 to 15. ${hint}`);
});

test('role params are visible only inside the role', () => {
  assert.equal(getFact('c3.p1.role_params_inside_role'), 'role-params', `Inside the role, role params should be what the task sees. ${hint}`);
  assert.equal(getFact('c3.p1.role_params_visible_after_role'), false, `A task after the role should not see role params. ${hint}`);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(3), { containers: 0, networks: 0, volumes: 0 });
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
