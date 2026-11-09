// Challenge 10, part 3: recover it. A rollout stops halfway. Bring the fleet back, measure how long it takes, write the runbook.
// Run: node challenges/challenge-10-capstone/part-3-recover-it/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the reference recover.yml and RUNBOOK.md (for maintainers).
//
// Three times: your rollout.yml with the bad setting (it stops), then YOUR recover.yml, then a health check through the proxy.
// The time is measured by this script from the moment the rollout stopped to the first 200: not the time you spend thinking.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { Recorder } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { median, round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { CHALLENGE, assertRoles, showLearnerPaths, clearFacts, clip, closeStack, code, digest, openStack, saveFacts, text } from '../lib.mjs';
import { parseRunbook } from './runbook.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const rec = showLearnerPaths(new Recorder('Challenge 10, part 3: recover it'));
const facts = {};
const f = (name, v) => (facts[`c10.p3.${name}`] = v);

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const BAD = 'app_log_level=verbose';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let S;
try {
  cleanup(CHALLENGE);
  S = await openStack();
  clearFacts('c10.p3.');
  assertRoles(S);
  const REL = S.rel;
  const SHOWN = REL.replace('-reference', '');
  const INV = `${REL}/inventory.ini`;
  const playbook = (name, extra = []) => S.ci.play(['ansible-playbook', '-i', INV, `${REL}/${name}`, ...extra]);
  const changedOf = (out) => Object.values(S.ci.parseRecap(out)).reduce((a, h) => a + h.changed, 0);
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

  if (!code(S, 'recover.yml').trim()) throw new Error('recover.yml is empty. Write the recovery (see the TODO comments in the file), then run this again.');
  if (!code(S, 'rollout.yml').trim()) throw new Error('rollout.yml is empty. Part 2 comes first.');

  // Step 0: a new fleet, configured.
  await fleetReset();
  const base = playbook('site.yml');
  if (base.code !== 0) throw new Error(`site.yml failed, so there is nothing to break. Fix part 1 first.\n${clip(digest(base.stdout), 20)}`);
  const h0 = health();
  rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/site.yml`, clip(digest(base.stdout), 8), `The fleet is configured: the proxy answers ${h0.status}, release ${h0.release}.`);

  // Steps 1 to 3: break it, recover it, three times.
  const runs = [];
  for (let i = 1; i <= 3; i++) {
    const bad = playbook('rollout.yml', ['-e', BAD]);
    const stoppedAt = Date.now();
    const recap = S.ci.parseRecap(bad.stdout);
    const failed = Object.entries(recap).filter(([, h]) => h.failed > 0).map(([n]) => n);
    if (failed.length !== 1) {
      throw new Error(`The rollout with a bad setting should fail on exactly one host, and it failed on ${failed.length}. Part 2 comes first: your rollout.yml must run, and fail on the app host.\n${clip(digest(bad.stdout), 20)}`);
    }
    const down = health();
    const changedBefore = Object.values(recap).filter((h) => h.failed === 0 && h.changed > 0).length;

    const rec1 = playbook('recover.yml');
    // The check: the proxy must answer 200 with the app and the database behind it. Poll for up to 60 s.
    let green = null;
    for (let k = 0; k < 60 && !green; k++) {
      const r = S.ci.get('http://web1/health');
      if (r.status === 200) green = Date.now();
      else await sleep(1000);
    }
    const recoverS = green ? round((green - stoppedAt) / 1000, 1) : 999;
    runs.push({ recoverS, downStatus: down.status, changedBefore, recoverOk: rec1.code === 0 });
    if (i === 1) {
      rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/rollout.yml -e ${BAD}`, clip(digest(bad.stdout), 24), `The rollout stopped. Failed: ${failed.join(', ')}. The proxy now answers ${down.status} (release header ${down.header}). The clock starts here.`);
      rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/recover.yml`, clip(digest(rec1.stdout), 34), `recover.yml ${rec1.code === 0 ? 'finished' : 'FAILED'}. The first 200 from the proxy came ${recoverS} s after the stop.`);
    }
  }
  const secs = runs.map((r) => r.recoverS);
  const recoverS = round(median(secs), 1);
  rec.step('three runs of: break it, recover it, check the proxy (the numbers are seconds from the stop to the first 200)', runs.map((r, i) => `run ${i + 1}: down answered ${r.downStatus}, recovered in ${r.recoverS} s, recover.yml ${r.recoverOk ? 'ok' : 'failed'}`).join('\n'), `The median is ${recoverS} s (${round(recoverS / 60, 2)} minutes). This is script time. A person needs their own minutes to read, think and type.`);

  // Step 4: the fleet must be at the state site.yml describes, and every host on release 1.
  const zero = playbook('site.yml');
  const zeroChanged = Object.keys(S.ci.parseRecap(zero.stdout)).length ? changedOf(zero.stdout) : 99;
  const hz = health();
  rec.step(`node toolkit/ansible.mjs ansible-playbook -i ${INV} ${SHOWN}/site.yml`, clip(digest(zero.stdout), 10), zeroChanged === 0 ? `After the recovery, site.yml changes nothing (changed=0). The app says release ${hz.release}, the proxy header says ${hz.header}.` : `site.yml still changes ${zeroChanged} tasks after the recovery. The recovery did not end in the state the playbook describes.`);

  f('recovered', secs.every((s) => s < 999) && runs.every((r) => r.recoverOk));
  f('recover_health_status', hz.status);
  f('recover_s', recoverS);
  f('recover_min', round(recoverS / 60, 2));
  f('recover_runs_s', secs.join(','));
  f('down_status', runs[0].downStatus);
  f('zero_after_recover_changed_count', zeroChanged);
  f('release_after_recover', hz.release);
  f('proxy_release_after_recover', hz.header);

  // Step 5: the runbook.
  const p2 = getFact('c10.p2.bad_changed_before_stop_count');
  const book = parseRunbook(text(S, 'RUNBOOK.md'), { stop: typeof p2 === 'number' ? p2 : runs[0].changedBefore, recover: recoverS });
  f('runbook_entries_count', book.entries.length);
  f('runbook_complete_count', book.complete);
  f('runbook_numbers_match', book.numbersMatch);
  rec.step('read RUNBOOK.md: one entry for the stopped rollout and one for the 502, each with its fields and a number from your run', book.report.join('\n'), book.complete === 2 && book.numbersMatch ? 'Both entries are complete and quote the numbers this run measured. A mentor reads whether a stranger could follow them.' : 'Not finished: each entry needs Symptom, Check (with commands in backticks), Cause, Fix, Prevention and a Measured line that matches the run above.');

  saveFacts(facts);
  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${S.reference ? '. The maintainer run used the reference recover.yml and RUNBOOK.md; the paths above show capstone-stack' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Seconds from the stop of the rollout to the first 200 from the proxy',
        unit: 's',
        bars: [...secs.map((s, i) => ({ label: `run ${i + 1}`, value: s })), { label: 'median', value: recoverS }],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
  console.log(`\nRecovered in ${recoverS} s (median of three). See: node toolkit/show-facts.mjs c10.p3`);
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  closeStack(S);
  cleanup(CHALLENGE);
}
