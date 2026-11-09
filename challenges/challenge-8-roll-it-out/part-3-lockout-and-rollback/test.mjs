// Challenge 8, part 3 test.
// Run: node --test challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/test.mjs
// It fails until you have finished push-safe.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning, execIn } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/run.mjs';
const HOSTS = ['web1', 'web2', 'web3', 'web4', 'web5', 'web6', 'db1'];

test('push-safe.yml has serial 1, validate and a new-login check', () => {
  // The run saves which file it used, so a maintainer run with --reference is checked too.
  const file = getFact('c8.p3.push_safe_file') ?? 'challenges/challenge-8-roll-it-out/part-3-lockout-and-rollback/push-safe.yml';
  const text = readFileSync(join(here, '..', '..', '..', file), 'utf8');
  assert.match(text, /^\s*serial:\s*1\s*$/m, 'push-safe.yml needs "serial: 1" (TODO 1).');
  assert.match(text, /^\s*validate:\s*.*sshd -t -f %s/m, 'push-safe.yml needs "validate: sshd -t -f %s" (TODO 2).');
  assert.match(text, /^\s*(ansible\.builtin\.)?meta:\s*reset_connection\s*$/m, 'push-safe.yml needs a "meta: reset_connection" task before the check (TODO 3).');
  assert.match(text, /^\s*(ansible\.builtin\.)?wait_for_connection:/m, 'push-safe.yml needs a wait_for_connection task (TODO 3).');
});

test('a connection that is already open survives a changed sshd, a new login does not', () => {
  assert.equal(getFact('c8.p3.held_connection_survives'), true, `The held connection should still answer after the bad push. ${hint}`);
  assert.equal(getFact('c8.p3.new_login_refused_after_close'), true, `After the held connection is closed, a new login should be refused. ${hint}`);
  assert.equal(getFact('c8.p3.no_sharing_unreachable_at_restart'), true, `With sharing off, the task after the file write should be UNREACHABLE. ${hint}`);
});

test('validate refuses a typo but passes a file that locks you out', () => {
  assert.equal(getFact('c8.p3.validate_refused'), true, `validate should refuse the typo and leave the file alone. ${hint}`);
  assert.equal(getFact('c8.p3.validate_passes_lockout_file'), true, `sshd -t finds nothing wrong with AllowUsers deploy. ${hint}`);
});

test('the lockout: one canary, then every host, and the plays looked green', () => {
  assert.equal(getFact('c8.p3.canary_play_green'), true, `The unsafe canary play should end green. ${hint}`);
  assert.equal(getFact('c8.p3.lost_canary'), 1, `One canary push loses one host. ${hint}`);
  assert.equal(getFact('c8.p3.play_failed_hosts_all_at_once'), 0, `The unsafe play reports no failed host. ${hint}`);
  assert.equal(getFact('c8.p3.answers_before_close_all_at_once'), 7, `Right after the push, the held connections still answer. ${hint}`);
  assert.equal(getFact('c8.p3.lost_all_at_once'), 7, `Pushing to all hosts at once loses all 7. ${hint}`);
  assert.equal(getFact('c8.p3.recovered_all'), 7, `The second way in (docker exec) brings all 7 back. ${hint}`);
});

test('YOUR safe playbook loses one host, not seven, and leaves the rest alone', () => {
  assert.equal(getFact('c8.p3.safe_stopped_at_first_host'), true, `The safe play should stop at the first host with the new-login timeout. Check all three TODOs in push-safe.yml. ${hint}`);
  assert.equal(getFact('c8.p3.lost_with_serial'), 1, `With serial 1 and a new-login check, only one host should be lost, it was ${getFact('c8.p3.lost_with_serial')}. ${hint}`);
  assert.equal(getFact('c8.p3.untouched_with_serial'), 6, `The six other hosts should keep their file. ${hint}`);
});

test('a harmless change goes through on all hosts, and the rollback undoes it', () => {
  assert.equal(getFact('c8.p3.safe_good_changed'), 7, `The safe playbook should change all 7 hosts when the file is fine. ${hint}`);
  assert.equal(getFact('c8.p3.differs'), true);
  assert.equal(getFact('c8.p3.rollback_ok'), true, `After the rollback all 7 hosts should hold their first file and answer. ${hint}`);
});

test('now: all hosts are running, answer a new login, and none has an AllowUsers line', () => {
  const running = fleetRunning();
  for (const s of ['control', ...HOSTS]) assert.ok(running.includes(s), `${s} is not running. Start the rollout fleet: node toolkit/fleet.mjs up --rollout`);
  for (const h of HOSTS) {
    const r = execIn(h, ['grep', '-c', '^AllowUsers', '/etc/ssh/sshd_config']);
    assert.equal(r.stdout.trim(), '0', `${h} still has an AllowUsers line in sshd_config. Restore it: docker exec anp-${h} sh -c 'cp -p /etc/ssh/sshd_config.before-push /etc/ssh/sshd_config && service ssh restart'`);
  }
  const ping = ansible(['ansible', 'all', '-i', 'inventory/rollout.ini', '-m', 'ping']);
  assert.equal(countLines(ping.stdout, /"ping": "pong"/), 7, `Not every host answers a new login:\n${ping.stdout}`);
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
