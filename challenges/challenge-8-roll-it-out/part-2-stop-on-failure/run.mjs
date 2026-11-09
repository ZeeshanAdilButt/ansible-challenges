// Challenge 8, part 2: stop on failure.
// Run: node challenges/challenge-8-roll-it-out/part-2-stop-on-failure/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against reference/my-rollout.yml (for maintainers).
// Helpers are described in toolkit/README.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset, fleetRunning, fleetUp, execIn, ROLLOUT_HOSTS } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 8, part 2: stop on failure');

const CHALLENGE = 8;
// Folder of this part as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-8-roll-it-out/part-2-stop-on-failure';
const INV = `${PART}/rollout-with-bad-web3.ini`;
const MINE = `${PART}/${reference ? 'reference/' : ''}my-rollout.yml`;
const PUSH = `${PART}/push-config.yml`;
const WEB = ['web1', 'web2', 'web3', 'web4', 'web5', 'web6'];
const shown = (text) => text.replaceAll('/reference/my-rollout.yml', '/my-rollout.yml');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// Put the old config (version 1) on every web host.
function seed() {
  const r = ansible(['ansible-playbook', '-i', INV, `${PART}/seed.yml`]);
  if (r.code !== 0) throw new Error(`seed.yml failed:\n${r.stdout}`);
}

// The state of each web host after a push: changed (holds version 2), failed (the recap says so), untouched (the rest).
function outcome(stdout) {
  const failed = new Set();
  const done = new Set();
  for (const m of stdout.matchAll(/^(web\d)\s+:\s+ok=(\d+)\s+changed=\d+\s+unreachable=(\d+)\s+failed=(\d+)/gm)) {
    if (Number(m[3]) + Number(m[4]) > 0) failed.add(m[1]);
    else if (Number(m[2]) >= 2) done.add(m[1]); // both tasks ran: the config was written and the app restarted
  }
  const changed = WEB.filter((h) => execIn(h, ['cat', '/etc/anp-app.conf']).stdout.includes('version=2'));
  const untouched = WEB.filter((h) => !changed.includes(h) && !failed.has(h));
  const halfDone = changed.filter((h) => !done.has(h)); // new config written, restart skipped
  return { changed, failed: [...failed].sort(), untouched, halfDone };
}

const quote = (a) => (/[\s:&!*"{]/.test(a) ? `'${a}'` : a);

// Seed, push, record. key is the fact suffix.
function trial(key, file, extra, note) {
  seed();
  const argv = ['ansible-playbook', '-i', INV, file, ...extra];
  const r = ansible(argv);
  const o = outcome(r.stdout);
  rec.step(shown(`node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), compactOutput(r.stdout), typeof note === 'function' ? note(o, r) : note);
  return { key, r, o };
}
const list = (a) => a.join(', ') || 'none';
const sum = (o) => `Changed ${o.changed.length} (${list(o.changed)}), failed ${o.failed.length} (${list(o.failed)}), untouched ${o.untouched.length} (${list(o.untouched)}). Half done, new config but no restart: ${o.halfDone.length} (${list(o.halfDone)}).`;

try {
  cleanup(CHALLENGE);

  // The learner must have written the two keywords.
  const text = readFileSync(join(here, reference ? 'reference/my-rollout.yml' : 'my-rollout.yml'), 'utf8');
  if (!/^\s*serial:/m.test(text) || !/^\s*max_fail_percentage:/m.test(text)) {
    throw new Error('my-rollout.yml needs a "serial:" line and a "max_fail_percentage:" line. Open it, read the TODO, add them, and run this again.');
  }

  if (!ROLLOUT_HOSTS.every((h) => fleetRunning().includes(h))) await fleetUp({ rollout: true });
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // The failing host: web3 has workers=0 in host_vars/web3.yml, and the config check refuses it.
  const t = {};
  t.no_serial = trial('no_serial', PUSH, [], (o) => `No serial: every host in one batch. ${sum(o)} Only the host that fails the check is spared. Nothing stops the rollout.`);
  t.serial = trial('serial', PUSH, ['-e', 'batch=2'], (o) => `serial: 2 alone. ${sum(o)} web3 failed in batch 2, its batch partner web4 went on, and batch 3 still ran. A failure alone does not stop a rollout.`);
  t.serial_1 = trial('serial_1', PUSH, ['-e', 'batch=1'], (o) => `serial: 1. ${sum(o)} A batch of one that fails is a batch where every host failed, and that stops the play.`);
  t.max_fail = trial('max_fail', PUSH, ['-e', 'batch=2', '-e', 'max_fail=30'], (o) => `serial: 2 with max_fail_percentage: 30. ${sum(o)} In batch 2 one of two hosts failed. That is 50 percent, more than 30, so the play stopped after that batch.`);
  t.max_fail_only = trial('max_fail_only', PUSH, ['-e', 'max_fail=10'], (o) => `max_fail_percentage: 10 with no serial. ${sum(o)} One host of six is 16.7 percent, more than 10, so the play stopped. But the failing task had already run on every host, and the restart task never ran.`);
  t.any_fatal = trial('any_fatal', PUSH, ['-e', 'fatal=true'], (o) => `any_errors_fatal with no serial. ${sum(o)} The failing task finished on every host of the batch (all six), then the play stopped. The restart task never ran.`);
  t.serial_any_fatal = trial('serial_any_fatal', PUSH, ['-e', 'batch=2', '-e', 'fatal=true'], (o) => `any_errors_fatal with serial: 2. ${sum(o)} The failing task finished on batch 2, then the play stopped. Batch 3 never started.`);
  t.yours = trial('yours', MINE, [], (o) => `Your my-rollout.yml. ${sum(o)}`);

  const facts = {
    'c8.p2.playbook_file': MINE,
    'c8.p2.failing_host': 'web3',
  };
  const names = { no_serial: 'no_serial', serial: 'serial', serial_1: 'serial_1', max_fail: 'max_fail', max_fail_only: 'max_fail_only', any_fatal: 'any_fatal', serial_any_fatal: 'serial_any_fatal', yours: 'yours' };
  for (const [k, n] of Object.entries(names)) {
    facts[`c8.p2.changed_${n}`] = t[k].o.changed.length;
    facts[`c8.p2.failed_${n}`] = t[k].o.failed.length;
    facts[`c8.p2.untouched_${n}`] = t[k].o.untouched.length;
    facts[`c8.p2.half_done_${n}`] = t[k].o.halfDone.length;
  }
  facts['c8.p2.changed_hosts_serial'] = t.serial.o.changed.join(',');
  facts['c8.p2.changed_hosts_max_fail'] = t.max_fail.o.changed.join(',');
  facts['c8.p2.untouched_hosts_max_fail'] = t.max_fail.o.untouched.join(',');
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/my-rollout.yml; the paths below show my-rollout.yml' : ''}`);
    const bars = [];
    for (const [k, label] of [['no_serial', 'no serial'], ['serial', 'serial 2'], ['max_fail', 'serial 2, max_fail 30'], ['any_fatal', 'any_errors_fatal']]) {
      bars.push({ label: `${label}: changed`, value: t[k].o.changed.length });
      bars.push({ label: `${label}: untouched`, value: t[k].o.untouched.length });
    }
    writeFileSync(join(here, 'chart.svg'), barsSvg({ title: 'Web hosts changed and untouched when web3 fails, by setting', unit: 'hosts', bars }));
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
