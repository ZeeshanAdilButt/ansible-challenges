// Challenge 4, part 1: handlers.
// Run: node challenges/challenge-4-fail-on-purpose/part-1-handlers/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the fixed playbook in reference/ (for maintainers).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { answers, handlerHosts, parseRecap } from '../recap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 4, part 1: handlers');
const CHALLENGE = 4;
const HANDLER = 'Reload nginx';

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-4-fail-on-purpose/part-1-handlers';
const SITE = `${PART}/${reference ? 'reference/' : ''}site.yml`;
// A --reference run uses the fixed file, but results.md shows the path a learner types.
const shownPath = (text) => text.replaceAll('/reference/site.yml', '/site.yml');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// Run one ansible command, record it, and return the result. The command text is what you could type yourself.
function step(argv, note) {
  const r = ansible(argv);
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  rec.step(shownPath(`node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), compactOutput(r.stdout), typeof note === 'function' ? note(r) : note);
  return r;
}
const play = (file, extra = []) => ['ansible-playbook', file, ...extra];
const served = (note) => step(play(`${PART}/served.yml`), note);
const runsOf = (r) => handlerHosts(r.stdout, HANDLER);

try {
  cleanup(CHALLENGE);

  // Step 0: a known start. Three new targets, no nginx, nothing changed by hand.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // 1. First run: everything is new, so the config changes and the handler runs on each web host.
  const run1 = step(play(SITE), (r) => (runsOf(r).length ? `Handler "${HANDLER}" ran ${runsOf(r).length} times: once on each web host, at the end of the play, after the config task.` : `Handler "${HANDLER}" did not run.`));
  if (run1.code !== 0) throw new Error('site.yml failed. Read the error above, fix site.yml and run this again.');
  const first = runsOf(run1).length;
  if (first === 0) {
    throw new Error(`No handler ran. Open site.yml in this folder and do TODO 1 and TODO 2: notify: "${HANDLER}" on the config task, and a handler with that name.`);
  }

  // 2. Second run: nothing changes, so nothing is notified.
  const run2 = step(play(SITE), (r) => `Handler runs: ${runsOf(r).length}. The config task said ok, so it did not notify, so the handler did not run.`);
  const second = runsOf(run2).length;

  // 3. Only the config changes: just the handler's work is needed, nothing is installed again.
  served('nginx answers with the first message.');
  const run3 = step(play(SITE, ['-e', 'message=second']), (r) => `Only the config changed. Handler runs: ${runsOf(r).length}.`);
  const configChange = runsOf(run3).length;
  const after3 = answers(served('nginx answers with the new message: the handler reloaded it.').stdout);

  // 4. Two tasks notify the same handler: it still runs once per host.
  const two = step(play(`${PART}/two-notifies.yml`), (r) => `Two tasks changed and both notified. The handler ran ${runsOf(r).length} times in total, ${runsOf(r).filter((h) => h === 'web1').length} on web1.`);
  const twoHosts = runsOf(two);

  // 5. When does the handler run? At the end of the play, unless you flush.
  const noFlush = step(play(`${PART}/check-before-handler.yml`, ['-e', 'message=third']), 'The check task ran before the handler. It saw the old config. The handler ran later, at the end.');
  const staleNoFlush = answers(noFlush.stdout);
  const withFlush = step(play(`${PART}/flush.yml`, ['-e', 'message=fourth']), 'meta: flush_handlers ran the handler in the middle of the play. The check task saw the new config.');
  const freshFlush = answers(withFlush.stdout);

  // 6. A failure after the notifying task.
  const fail1 = step(play(`${PART}/fail-after.yml`, ['-e', 'message=v2']), (r) => `Exit code ${r.code}. web2 failed after its config task. The handler ran on ${runsOf(r).length} host (${runsOf(r).join(', ') || 'none'}).`);
  const failHosts = runsOf(fail1);
  const failRecap = parseRecap(fail1.stdout);
  const afterFail = answers(served('web1 answers v2. web2 still answers with the old message: its file says v2, but nginx never reloaded.').stdout);

  const fail2 = step(play(`${PART}/fail-after.yml`, ['-e', 'message=v2']), (r) => `The same run again. The config file is already v2 on both hosts, so nothing is notified. Handler runs: ${runsOf(r).length}.`);
  const rerunHosts = runsOf(fail2);
  const afterRerun = answers(served('web2 still answers with the old message. The trap: the file is right, nginx is not, and the next run does not show it.').stdout);

  // 7. Force the handlers to run even when a host fails.
  const forced = step(play(`${PART}/fail-after.yml`, ['-e', 'message=v3', '--force-handlers']), (r) => `With --force-handlers the handler ran on ${runsOf(r).length} hosts, also on the host that failed.`);
  const forcedHosts = runsOf(forced);
  const afterForce = answers(served('Both hosts answer v3.').stdout);

  const facts = {
    'c4.p1.handler_runs_first': first,
    'c4.p1.handler_runs_second': second,
    'c4.p1.handler_runs_config_change': configChange,
    'c4.p1.handler_runs_two_notifies': twoHosts.length,
    'c4.p1.handler_runs_two_notifies_web1': twoHosts.filter((h) => h === 'web1').length,
    'c4.p1.changed_first_run_web1': parseRecap(run1.stdout).web1?.changed,
    'c4.p1.config_change_applied': after3.web1 === 'second from web1' && after3.web2 === 'second from web2',
    'c4.p1.stale_without_flush': staleNoFlush.web1 === 'second from web1' && staleNoFlush.web2 === 'second from web2',
    'c4.p1.fresh_with_flush': freshFlush.web1 === 'fourth from web1' && freshFlush.web2 === 'fourth from web2',
    'c4.p1.fail_exit_code': fail1.code,
    'c4.p1.fail_handler_runs': failHosts.length,
    'c4.p1.fail_failed_hosts': Object.values(failRecap).filter((row) => row.failed > 0).length,
    'c4.p1.fail_web2_stale': afterFail.web1 === 'v2 from web1' && afterFail.web2 === 'fourth from web2',
    'c4.p1.fail_rerun_handler_runs': rerunHosts.length,
    'c4.p1.fail_rerun_web2_stale': afterRerun.web2 === 'fourth from web2',
    'c4.p1.force_handler_runs': forcedHosts.length,
    'c4.p1.force_web2_fresh': afterForce.web1 === 'v3 from web1' && afterForce.web2 === 'v3 from web2',
    'c4.p1.reset_s': round(resetS, 1),
    'c4.p1.playbook_file': SITE,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/site.yml; the paths below show site.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'How many times the handler ran (summed over web1 and web2)',
        unit: 'runs',
        bars: [
          { label: 'first run', value: facts['c4.p1.handler_runs_first'] },
          { label: 'second run', value: facts['c4.p1.handler_runs_second'] },
          { label: 'config change only', value: facts['c4.p1.handler_runs_config_change'] },
          { label: 'two notifies', value: facts['c4.p1.handler_runs_two_notifies'] },
          { label: 'web2 fails', value: facts['c4.p1.fail_handler_runs'] },
          { label: 'rerun after failure', value: facts['c4.p1.fail_rerun_handler_runs'] },
          { label: 'web2 fails, forced', value: facts['c4.p1.force_handler_runs'] },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
