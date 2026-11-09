// Challenge 5, part 2 test.
// Run: node --test challenges/challenge-5-your-first-role/part-2-pin-a-collection/test.mjs
// It fails until you have pinned the collection in requirements.yml and run run.mjs once. That is on purpose.
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
const root = join(here, '..', '..', '..');
const PART = 'challenges/challenge-5-your-first-role/part-2-pin-a-collection';
const hint = `Run: node ${PART}/run.mjs`;

test('requirements.yml pins ansible.posix to one exact version', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c5.p2.requirements_file') ?? `${PART}/requirements.yml`;
  const code = readFileSync(join(root, rel), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  assert.match(code, /name:\s*ansible\.posix\s*$/m, 'requirements.yml should list the collection ansible.posix.');
  const m = code.match(/^\s+version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m);
  assert.ok(m, 'Add a line  version: "2.1.0"  under the name. An exact version has three numbers and no >= or *.');
  assert.equal(m[1], getFact('c5.p2.pinned_version'), `The file pins ${m[1]} but the last run installed ${getFact('c5.p2.pinned_version')}. ${hint}`);
});

test('the pinned version is installed, and it is not the newest one', () => {
  assert.match(String(getFact('c5.p2.pinned_version')), /^\d+\.\d+\.\d+$/, `c5.p2.pinned_version should look like 2.1.0. ${hint}`);
  assert.match(String(getFact('c5.p2.latest_version')), /^\d+\.\d+\.\d+$/, `c5.p2.latest_version should look like 2.2.2. ${hint}`);
  const t = getFact('c5.p2.install_s');
  assert.ok(typeof t === 'number' && t > 0, `c5.p2.install_s should be a number of seconds. ${hint}`);
});

test('without the collection the module is not found, with it the module works', () => {
  assert.equal(getFact('c5.p2.missing_collection_exit_code'), 4, `A missing module makes ansible-playbook exit with 4. ${hint}`);
  assert.match(String(getFact('c5.p2.missing_collection_message')), /ansible\.posix\.sysctl/, `The message should name the module. ${hint}`);
  assert.equal(getFact('c5.p2.use_changed_first'), 2, `The module should change 2 hosts the first time. ${hint}`);
  assert.equal(getFact('c5.p2.use_changed_second'), 0, `The module should change nothing the second time. ${hint}`);
});

test('a second install does nothing, and an impossible pin is an error', () => {
  assert.equal(getFact('c5.p2.second_install_nothing'), true, `A second install should say there is nothing to do. ${hint}`);
  assert.equal(getFact('c5.p2.bad_pin_exit_code'), 1, `An impossible pin makes ansible-galaxy exit with 1. ${hint}`);
  assert.match(String(getFact('c5.p2.bad_pin_message')), /99\.0\.0/, `The error should name the version 99.0.0. ${hint}`);
});

test('the collection is on disk now, at the pinned version', () => {
  assert.ok(fleetRunning().includes('control'), 'The control container is not running. Start the fleet: node toolkit/fleet.mjs up');
  const r = ansible(['ansible-galaxy', 'collection', 'list', '-p', 'collections']);
  const v = (r.stdout.match(/^ansible\.posix\s+(\S+)\s*$/m) || [])[1];
  assert.equal(v, getFact('c5.p2.pinned_version'), `collections/ should hold ansible.posix ${getFact('c5.p2.pinned_version')}, it holds ${v}. ${hint}\n${r.stdout}`);
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(5), { containers: 0, networks: 0, volumes: 0 });
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
