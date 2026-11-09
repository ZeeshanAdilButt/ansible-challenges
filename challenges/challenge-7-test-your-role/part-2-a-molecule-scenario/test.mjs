// Challenge 7, part 2 test.
// Run: node --test challenges/challenge-7-test-your-role/part-2-a-molecule-scenario/test.mjs
// It fails until verify.yml has three assertions and you have run run.mjs. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { COLLECTIONS, moleculeRunArgs } from '../../../toolkit/molecule.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-7-test-your-role/part-2-a-molecule-scenario';
const hint = `Run: node ${PART}/run.mjs`;

test('verify.yml has at least three assert tasks', () => {
  const text = readFileSync(join(here, 'roles', 'webserver', 'molecule', 'default', 'verify.yml'), 'utf8');
  const n = (text.match(/ansible\.builtin\.assert:/g) ?? []).length;
  // After a maintainer run with --reference the file is put back, so also accept the recorded result.
  assert.ok(n >= 3 || getFact('c7.p2.verify_asserts') >= 3, `verify.yml has ${n} assert task(s). Write the two TODO assertions (config port, home page).`);
});

test('the full molecule test passed', () => {
  assert.equal(getFact('c7.p2.steps_failed'), 0, `A molecule step failed. ${hint}`);
  assert.equal(getFact('c7.p2.steps_passed'), 7, `7 steps should pass (destroy, syntax, create, converge, idempotence, verify, destroy). ${hint}`);
  assert.equal(getFact('c7.p2.verify_asserts'), 3, `3 assertions should pass in the verify step. ${hint}`);
  assert.ok(getFact('c7.p2.test_s') > 0, `c7.p2.test_s is missing. ${hint}`);
  assert.equal(getFact('c7.p2.handler_ran_in_converge'), true, 'The Reload nginx handler should run once in converge.');
});

test('the test machine was named and labelled so cleanup can find it', () => {
  assert.equal(getFact('c7.p2.instance_labelled'), true);
});

test('the Molecule container design: socket mounted, normal user, no privileged mode', () => {
  const args = moleculeRunArgs(7, { gid: '0' }).join(' ');
  assert.match(args, /-v \/var\/run\/docker\.sock:\/var\/run\/docker\.sock/);
  assert.match(args, /--user 1000:1000/);
  assert.match(args, /--security-opt no-new-privileges/);
  assert.ok(!/--privileged/.test(args));
  assert.match(args, /--name anp-c7-molecule/);
  assert.match(args, /--label anp\.challenge=7/);
});

test('the collections are pinned to exact versions', () => {
  for (const [name, version] of Object.entries(COLLECTIONS)) assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must have an exact version`);
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
