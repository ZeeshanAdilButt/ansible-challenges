// Challenge 8, part 1 test.
// Run: node --test challenges/challenge-8-roll-it-out/part-1-serial-batches/test.mjs
// It fails until you have added the serial line to rollout.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning, execIn } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-8-roll-it-out/part-1-serial-batches/run.mjs';

test('rollout.yml has a serial line', () => {
  // The run saves which file it used, so a maintainer run with --reference is checked too.
  const file = getFact('c8.p1.playbook_file') ?? 'challenges/challenge-8-roll-it-out/part-1-serial-batches/rollout.yml';
  const text = readFileSync(join(here, '..', '..', '..', file), 'utf8');
  assert.match(text, /^\s*serial:/m, 'rollout.yml has no "serial:" line. Open it, read the TODO and add one line.');
});

test('the rollout made three batches of 1, 2 and 3 hosts', () => {
  assert.equal(getFact('c8.p1.batches'), 3, `c8.p1.batches should be 3. ${hint}`);
  assert.equal(getFact('c8.p1.batch_sizes'), '1,2,3', `c8.p1.batch_sizes should be "1,2,3", it is "${getFact('c8.p1.batch_sizes')}". Check the serial list in rollout.yml. ${hint}`);
});

test('the other plans behaved as recorded', () => {
  assert.equal(getFact('c8.p1.sizes_serial_2'), '2,2,2', `serial: 2 on six hosts gives 2,2,2. ${hint}`);
  assert.equal(getFact('c8.p1.sizes_list_1_2'), '1,2,2,1', `serial: [1, 2] gives 1,2,2,1: the last number repeats. ${hint}`);
  assert.equal(getFact('c8.p1.sizes_percent_30'), '1,1,1,1,1,1', `"30%" of six hosts rounds down to 1 host per batch. ${hint}`);
  assert.equal(getFact('c8.p1.sizes_no_serial'), '6', `No serial means one batch of 6. ${hint}`);
});

test('smaller batches take longer', () => {
  const none = getFact('c8.p1.seconds_no_serial');
  const mid = getFact('c8.p1.seconds_serial_1_2_3');
  const one = getFact('c8.p1.seconds_serial_1');
  assert.ok(none > 0 && mid > 0 && one > 0, `The timing facts are missing. ${hint}`);
  assert.ok(none < one, `One batch (${none} s) should be faster than six batches (${one} s). ${hint}`);
  assert.ok(mid < one, `Three batches (${mid} s) should be faster than six batches (${one} s). ${hint}`);
});

test('the six web hosts run now and each has an app config', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'web3', 'web4', 'web5', 'web6', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the rollout fleet: node toolkit/fleet.mjs up --rollout`);
  }
  // Run the rollout again now. Another part may have reset the hosts since run.mjs ran.
  const file = getFact('c8.p1.playbook_file') ?? 'challenges/challenge-8-roll-it-out/part-1-serial-batches/rollout.yml';
  const r = ansible(['ansible-playbook', '-i', 'inventory/rollout.ini', file]);
  assert.equal(r.code, 0, `The rollout failed:
${r.stdout}`);
  const batches = r.stdout
    .split(/^PLAY \[/m)
    .slice(1)
    .filter((seg) => !seg.startsWith('RECAP'))
    .map((seg) => new Set([...seg.matchAll(/^(?:changed|ok): \[(\w+)\]/gm)].map((m) => m[1])).size);
  assert.deepEqual(batches, [1, 2, 3], `Batch sizes now are [${batches}], not [1,2,3].`);
  for (const h of ['web1', 'web2', 'web3', 'web4', 'web5', 'web6']) {
    assert.equal(execIn(h, ['cat', '/etc/anp-app.conf']).stdout.trim(), 'version=2', `${h} does not hold the new config. ${hint}`);
  }
  assert.equal(getFact('c8.p1.hosts_with_new_config'), 6);
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(8), { containers: 0, networks: 0, volumes: 0 });
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
