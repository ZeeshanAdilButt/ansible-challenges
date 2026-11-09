// Challenge 8, part 2 test.
// Run: node --test challenges/challenge-8-roll-it-out/part-2-stop-on-failure/test.mjs
// It fails until you have added the two keywords to my-rollout.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-8-roll-it-out/part-2-stop-on-failure/run.mjs';

test('my-rollout.yml has serial and max_fail_percentage', () => {
  // The run saves which file it used, so a maintainer run with --reference is checked too.
  const file = getFact('c8.p2.playbook_file') ?? 'challenges/challenge-8-roll-it-out/part-2-stop-on-failure/my-rollout.yml';
  const text = readFileSync(join(here, '..', '..', '..', file), 'utf8');
  assert.match(text, /^\s*serial:\s*2\s*$/m, 'my-rollout.yml needs "serial: 2". Open it and read the TODO.');
  assert.match(text, /^\s*max_fail_percentage:\s*\d+\s*$/m, 'my-rollout.yml needs a "max_fail_percentage:" line with a number. Open it and read the TODO.');
});

test('without any setting the failure does not stop anything', () => {
  assert.equal(getFact('c8.p2.changed_no_serial'), 5, `With no serial, five hosts change and web3 fails. ${hint}`);
  assert.equal(getFact('c8.p2.failed_no_serial'), 1);
  assert.equal(getFact('c8.p2.untouched_no_serial'), 0);
});

test('serial alone does not stop the rollout either', () => {
  assert.equal(getFact('c8.p2.changed_serial'), 5, `serial: 2 alone still changes five hosts. ${hint}`);
  assert.equal(getFact('c8.p2.untouched_serial'), 0, `serial: 2 alone leaves no host untouched. ${hint}`);
});

test('max_fail_percentage with serial stops after the bad batch', () => {
  assert.equal(getFact('c8.p2.changed_max_fail'), 3, `web1, web2 and web4 change. ${hint}`);
  assert.equal(getFact('c8.p2.untouched_max_fail'), 2, `web5 and web6 stay untouched. ${hint}`);
  assert.equal(getFact('c8.p2.untouched_hosts_max_fail'), 'web5,web6');
  assert.equal(getFact('c8.p2.half_done_max_fail'), 1, `web4 has the new config but did not restart. ${hint}`);
});

test('any_errors_fatal and serial 1 behave as recorded', () => {
  assert.equal(getFact('c8.p2.changed_any_fatal'), 5, `any_errors_fatal with no serial: the failing task still ran on the other five. ${hint}`);
  assert.equal(getFact('c8.p2.half_done_any_fatal'), 5, `...and none of them ran the restart. ${hint}`);
  assert.equal(getFact('c8.p2.untouched_serial_1'), 3, `serial: 1 stops after web3. ${hint}`);
});

test('YOUR rollout stops early: one host fails and at least two hosts stay untouched', () => {
  assert.equal(getFact('c8.p2.failed_yours'), 1, `Your rollout should fail on web3 only. ${hint}`);
  const untouched = getFact('c8.p2.untouched_yours');
  assert.ok(untouched >= 2, `Your rollout left ${untouched} hosts untouched. It should leave at least 2 (web5 and web6). Check max_fail_percentage: the failed share must be MORE than it. ${hint}`);
});

test('the six web hosts run now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'web3', 'web4', 'web5', 'web6', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the rollout fleet: node toolkit/fleet.mjs up --rollout`);
  }
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
