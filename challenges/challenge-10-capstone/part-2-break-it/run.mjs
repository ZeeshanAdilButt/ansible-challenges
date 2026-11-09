// Challenge 10, part 2: break it. Roll a change across the fleet, one host at a time, with a bad setting.
// Run: node challenges/challenge-10-capstone/part-2-break-it/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the reference rollout.yml (for maintainers).
//
// 1. A new fleet, configured with site.yml (release 1).
// 2. YOUR rollout.yml with a good release 2: batch sizes, hosts changed.
// 3. YOUR rollout.yml with a bad setting for the app (log_level=verbose, which the app refuses): where does it stop?
// 4. Four drills with the same bad setting and different play keywords, to see what each keyword does.

import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { CHALLENGE, assertRoles, showLearnerPaths, HOSTS, batches, clearFacts, clip, closeStack, code, digest, openStack, saveFacts } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const rec = showLearnerPaths(new Recorder('Challenge 10, part 2: break it'));
const facts = {};
const f = (name, v) => (facts[`c10.p2.${name}`] = v);

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const BAD = 'app_log_level=verbose';
const PLAY_NAME = 'Roll out release 2';

let S;
const drillFiles = [];
try {
  cleanup(CHALLENGE);
  S = await openStack();
  clearFacts('c10.p2.');
  assertRoles(S);
  const REL = S.rel;
  const SHOWN = REL.replace('-reference', '');
  const INV = `${REL}/inventory.ini`;
  const seconds = (t0) => round((Date.now() - t0) / 1000, 1);

  if (!/^\s*serial:/m.test(code(S, 'rollout.yml')) && !S.reference) {
    // Not an error yet: a rollout without serial is allowed to run. But say what the first run will show.
    console.log('Note: rollout.yml has no serial: line yet. The run will show what that means.');
  }
  if (!code(S, 'rollout.yml').trim()) throw new Error('rollout.yml is empty. Write the play (see the TODO comments in the file).');

  const playbook = (name, extra = []) => S.ci.play(['ansible-playbook', '-i', INV, `${REL}/${name}`, ...extra]);
  const baseline = () => {
    const t0 = Date.now();
    const r = playbook('site.yml');
    const recap = S.ci.parseRecap(r.stdout);
    if (r.code !== 0 || Object.keys(recap).length !== 3) throw new Error(`site.yml failed, so the rollout drills have no starting point. Fix part 1 first.\n${clip(digest(r.stdout), 20)}`);
    return { s: seconds(t0), output: r.stdout, changed: Object.values(recap).reduce((a, h) => a + h.changed, 0) };
  };

  // What a run did: which hosts changed and kept going, which failed, which were never reached.
  function analyse(output, playName) {
    const recap = S.ci.parseRecap(output);
    const ran = Object.keys(recap);
    const failed = ran.filter((h) => recap[h].failed > 0 || recap[h].unreachable > 0);
    const done = ran.filter((h) => !failed.includes(h) && recap[h].changed > 0);
    const untouched = HOSTS.filter((h) => !ran.includes(h));
    const sizes = batches(output, playName).map((b) => b.length);
    const lines = output.split(/\r?\n/);
    let task = '';
    let failedTask = '';
    for (const l of lines) {
      if (/^(TASK|RUNNING HANDLER) \[/.test(l)) task = l.replace(/\s*\*+$/, '');
      if (/^fatal: \[/.test(l) && !failedTask) failedTask = task;
    }
    return { recap, failed, done, untouched, sizes, failedTask };
  }
  const health = () => {
    const r = S.ci.get('http://web1/health');
    let body = {};
    try {
      body = JSON.parse(r.body);
    } catch {
      /* 502 pages are not JSON */
    }
    return { status: r.status, release: String(body.release ?? 'none'), header: String(r.headers?.['X-Capstone-Release'] ?? r.headers?.['x-capstone-release'] ?? 'none') };
  };

  // Step 0: a new fleet in the state of part 1.
  await fleetReset();
  const base = baseline();
  f('baseline_s', base.s);
  const h0 = health();
  rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/site.yml`, clip(digest(base.output), 12), `The starting point: release ${h0.release} on all three hosts, in ${base.s} s. The proxy answers ${h0.status}.`);

  // Step 1: a good rollout.
  const t1 = Date.now();
  const good = playbook('rollout.yml');
  const g = analyse(good.stdout, PLAY_NAME);
  const hg = health();
  f('good_s', seconds(t1));
  f('good_batches_count', g.sizes.length);
  f('good_batch_sizes', g.sizes.join(','));
  f('good_failed_count', g.failed.length);
  f('good_changed_count', g.done.length);
  f('good_release', hg.release);
  f('good_proxy_release', hg.header);
  rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/rollout.yml`, clip(digest(good.stdout), 30), `Batch sizes: ${g.sizes.join(', ') || 'none found'}. ${g.done.length} hosts changed, ${g.failed.length} failed. The proxy header says release ${hg.header}, the app says ${hg.release}.`);

  // Step 2: your rollout with a bad setting.
  baseline();
  const t2 = Date.now();
  const bad = playbook('rollout.yml', ['-e', BAD]);
  const stopS = seconds(t2);
  const b = analyse(bad.stdout, PLAY_NAME);
  const hb = health();
  f('bad_s', stopS);
  f('bad_batch_sizes', b.sizes.join(','));
  f('bad_failed_count', b.failed.length);
  f('bad_changed_before_stop_count', b.done.length);
  f('bad_untouched_count', b.untouched.length);
  f('bad_failed_host', b.failed.join(',') || 'none');
  f('bad_failed_task', b.failedTask || 'none');
  f('bad_health_status', hb.status);
  f('bad_proxy_release', hb.header);
  rec.step(
    `node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/rollout.yml -e ${BAD}`,
    clip(digest(bad.stdout), 34),
    `Failed: ${b.failed.join(', ') || 'none'} (task: ${b.failedTask.replace(/^TASK \[|^RUNNING HANDLER \[|\]$/g, '') || 'none'}). Changed before the stop: ${b.done.join(', ') || 'none'}. Never touched: ${b.untouched.join(', ') || 'none'}.`,
  );
  const probe = S.ci.play(['ansible', 'web', '-i', INV, '-m', 'ansible.builtin.uri', '-a', 'url=http://localhost/health status_code=200,502,503']);
  rec.step(
    `node toolkit/ansible.mjs ansible web -i ${INV} -m ansible.builtin.uri -a 'url=http://localhost/health status_code=200,502,503'`,
    compactOutput(probe.stdout),
    hb.status === 200 ? 'The proxy still answers 200.' : `The site is down for customers: the proxy answers ${hb.status} because the app behind it is gone. The proxy host has release ${hb.header}.`,
  );

  // Step 3: the drills. The same bad setting, the same fleet, four ways to write the play.
  const drill = (key, header) => {
    const file = `drill-${key}.yml`;
    writeFileSync(join(S.dir, file), `---\n- name: ${PLAY_NAME}\n  hosts: all\n  become: true\n${header}  vars_files:\n    - vars/release-2.yml\n  tasks:\n    - name: Roll out this host\n      ansible.builtin.import_tasks: tasks/release.yml\n`);
    drillFiles.push(join(S.dir, file));
    baseline();
    const t0 = Date.now();
    const r = playbook(file, ['-e', BAD]);
    const a = analyse(r.stdout, PLAY_NAME);
    f(`drill_${key}_changed_count`, a.done.length);
    f(`drill_${key}_failed_count`, a.failed.length);
    f(`drill_${key}_untouched_count`, a.untouched.length);
    f(`drill_${key}_s`, seconds(t0));
    return a;
  };
  const drills = [
    ['parallel', '', 'no serial: every host at once'],
    ['serial_only', '  serial: 1\n', 'serial: 1 and nothing else'],
    ['max_fail', '  serial: 1\n  max_fail_percentage: 25\n', 'serial: 1 and max_fail_percentage: 25'],
    ['any_fatal', '  serial: 1\n  any_errors_fatal: true\n', 'serial: 1 and any_errors_fatal: true'],
    ['serial2_only', '  serial: 2\n', 'serial: 2 and nothing else'],
    ['serial2_max_fail', '  serial: 2\n  max_fail_percentage: 25\n', 'serial: 2 and max_fail_percentage: 25'],
    ['serial2_any_fatal', '  serial: 2\n  any_errors_fatal: true\n', 'serial: 2 and any_errors_fatal: true'],
  ];
  const table = [];
  for (const [key, header, label] of drills) {
    const a = drill(key, header);
    table.push({ key, label, a });
  }
  const rows = table.map(({ label, a }) => `${label.padEnd(40)} changed ${a.done.length}  failed ${a.failed.length}  never reached ${a.untouched.length}${a.untouched.length ? ` (${a.untouched.join(', ')})` : ''}`);
  rec.step('seven drills: the same bad setting (-e app_log_level=verbose) with a different play header each time', rows.join('\n'), 'Read the last column. With batches of one, a failed host is a failed batch and the play ends. With batches of two, a failed host is dropped and the next batch still runs, unless a stop keyword says otherwise.');
  const works = table.filter(({ a }) => a.failed.length === 1 && a.untouched.length >= 1).map(({ key }) => key.replace('_', ' '));
  const stopText = code(S, 'rollout.yml');
  f('rollout_stop_keyword', /^\s*any_errors_fatal:\s*(true|yes)/m.test(stopText) ? 'any_errors_fatal' : /^\s*max_fail_percentage:/m.test(stopText) ? 'max_fail_percentage' : 'none');
  f('keywords_that_stop', table.filter(({ a }) => a.failed.length === 1 && a.untouched.length >= 1).map(({ key }) => key).join(','));

  // Leave the fleet healthy and on release 1.
  const end = baseline();
  const hEnd = health();
  rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/site.yml`, clip(digest(end.output), 10), `Release ${hEnd.release} is back and the proxy answers ${hEnd.status}. The fleet is left in this state.`);
  f('end_health_status', hEnd.status);

  saveFacts(facts);
  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${S.reference ? '. The maintainer run used the reference rollout.yml; the paths above show capstone-stack' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Hosts never reached after one host failed (of 3), by play header',
        unit: 'hosts',
        bars: [
          ...table.map(({ label, a }) => ({ label, value: a.untouched.length })),
          { label: 'your rollout.yml', value: b.untouched.length },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
  console.log(`\nYour rollout: ${b.done.length} changed before the stop, ${b.failed.length} failed, ${b.untouched.length} never reached. Keywords that stop it: ${works.join(', ') || 'none'}. See: node toolkit/show-facts.mjs c10.p2`);
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  for (const file of drillFiles) rmSync(file, { force: true });
  closeStack(S);
  cleanup(CHALLENGE);
}
