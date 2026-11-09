// Challenge 1, part 1 test.
// Run: node --test challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/test.mjs
// It fails until you have run run.mjs once. That is on purpose: read the failure, then fix it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-1-first-contact/part-1-check-setup-and-fleet/run.mjs';

test('Node is version 22 or newer', () => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 22, `You have ${process.version}`);
});

test('run.mjs saved its facts', () => {
  const control = getFact('c1.p1.control_image_mb');
  const target = getFact('c1.p1.target_image_mb');
  assert.ok(control > 100 && control < 2000, `c1.p1.control_image_mb should be between 100 and 2000, got ${control}. ${hint}`);
  assert.ok(target > 50 && target < 1000, `c1.p1.target_image_mb should be between 50 and 1000, got ${target}. ${hint}`);
  assert.ok(control > target, 'The control image holds Ansible and Molecule, so it should be bigger than a target.');
  const up = getFact('c1.p1.fleet_up_s');
  assert.ok(up > 0 && up < 120, `c1.p1.fleet_up_s should be between 0 and 120, got ${up}. ${hint}`);
  assert.equal(getFact('c1.p1.ping_ok_count'), 3, `c1.p1.ping_ok_count should be 3 (web1, web2, db1). ${hint}`);
  assert.equal(getFact('c1.p1.ansible_core_version'), '2.21.6', `c1.p1.ansible_core_version should be 2.21.6. ${hint}`);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('ansible reaches all three hosts right now', () => {
  const r = ansible(['ansible', 'all', '-m', 'ping']);
  assert.equal(r.code, 0, `ansible all -m ping failed:\n${r.stdout}`);
  assert.equal(countLines(r.stdout, /"ping": "pong"/), 3, `expected 3 pongs:\n${r.stdout}`);
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(1), { containers: 0, networks: 0, volumes: 0 });
});

test('the README links the safety rules', () => {
  assert.match(readFileSync(join(here, 'README.md'), 'utf8'), /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
});

test('results.md and the charts exist after a recorded run', () => {
  assert.ok(existsSync(join(here, 'results.md')), 'Run run.mjs with --record to write results.md');
  for (const f of ['chart.svg', 'chart-fleet-up.svg']) {
    assert.ok(existsSync(join(here, f)), `Run run.mjs with --record to write ${f}`);
    const svg = readFileSync(join(here, f), 'utf8');
    assert.match(svg, /role="img"/);
    assert.match(svg, /<title id="t">/);
    assert.match(svg, /<desc id="d">/);
  }
});
