// Challenge 4, part 1 test.
// Run: node --test challenges/challenge-4-fail-on-purpose/part-1-handlers/test.mjs
// It fails until you have done the two TODOs in site.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const PART = 'challenges/challenge-4-fail-on-purpose/part-1-handlers';
const hint = `Run: node ${PART}/run.mjs`;

test('site.yml notifies a handler named "Reload nginx" and defines it', () => {
  // The run records which file it used, so a maintainer run with --reference is checked too.
  const rel = getFact('c4.p1.playbook_file') ?? `${PART}/site.yml`;
  const text = readFileSync(join(root, rel), 'utf8');
  const code = text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(code, /^\s*notify:\s*["']?Reload nginx["']?\s*$/m, 'The config task needs: notify: Reload nginx (TODO 1 in site.yml).');
  assert.match(code, /^\s*handlers:\s*$/m, 'site.yml needs a handlers: section (TODO 2).');
  assert.match(code, /^\s*-\s*name:\s*Reload nginx\s*$/m, 'The handler must be named exactly: Reload nginx (TODO 2).');
  assert.match(code, /state:\s*reloaded/, 'The handler should reload nginx: state: reloaded (TODO 2).');
});

test('the handler ran on the first run and not on the second', () => {
  assert.equal(getFact('c4.p1.handler_runs_first'), 2, `c4.p1.handler_runs_first should be 2 (web1 and web2). ${hint}`);
  assert.equal(getFact('c4.p1.handler_runs_second'), 0, `c4.p1.handler_runs_second should be 0: nothing changed, nothing notified. ${hint}`);
  assert.equal(getFact('c4.p1.handler_runs_config_change'), 2, `A changed config should run the handler on both hosts. ${hint}`);
  assert.equal(getFact('c4.p1.config_change_applied'), true, `After the handler, nginx should answer with the new message. ${hint}`);
});

test('two notifies run the handler once per host', () => {
  assert.equal(getFact('c4.p1.handler_runs_two_notifies_web1'), 1, `The handler should run once on web1 even when two tasks notify it. ${hint}`);
  assert.equal(getFact('c4.p1.handler_runs_two_notifies'), 2, `The handler should run 2 times in total (web1 and web2). ${hint}`);
});

test('handlers run at the end of the play, unless you flush', () => {
  assert.equal(getFact('c4.p1.stale_without_flush'), true, `Without flush_handlers the check should see the old config. ${hint}`);
  assert.equal(getFact('c4.p1.fresh_with_flush'), true, `With flush_handlers the check should see the new config. ${hint}`);
});

test('a failure after the notify skips the handler on the failed host only', () => {
  assert.equal(getFact('c4.p1.fail_exit_code'), 2, `A failed host makes ansible-playbook exit with 2. ${hint}`);
  assert.equal(getFact('c4.p1.fail_failed_hosts'), 1, `One host (web2) should fail. ${hint}`);
  assert.equal(getFact('c4.p1.fail_handler_runs'), 1, `The handler should run on web1 only. ${hint}`);
  assert.equal(getFact('c4.p1.fail_web2_stale'), true, `web2 should still answer with the old message. ${hint}`);
  assert.equal(getFact('c4.p1.fail_rerun_handler_runs'), 0, `A rerun does not notify again, because the file is already right. ${hint}`);
  assert.equal(getFact('c4.p1.fail_rerun_web2_stale'), true, `web2 should still be stale after the rerun. ${hint}`);
});

test('--force-handlers runs the handler on the failed host too', () => {
  assert.equal(getFact('c4.p1.force_handler_runs'), 2, `With --force-handlers the handler should run on both hosts. ${hint}`);
  assert.equal(getFact('c4.p1.force_web2_fresh'), true, `Both hosts should answer v3 at the end. ${hint}`);
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
