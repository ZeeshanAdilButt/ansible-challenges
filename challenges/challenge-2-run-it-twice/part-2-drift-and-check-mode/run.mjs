// Challenge 2, part 2: drift, check mode and diff.
// Run: node challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run the fixed playbook in reference/ (for maintainers).

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

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 2, part 2: drift and check mode');
const CHALLENGE = 2;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-2-run-it-twice/part-2-drift-and-check-mode';
const PLAYBOOK = `${PART}/${reference ? 'reference/' : ''}site.yml`;
// A --reference run uses the fixed file, but results.md shows the path a learner types.
const shown = (text) => text.replaceAll('/reference/site.yml', '/site.yml');

const MIN_TASKS = 7;
const DRIFT = "echo 'Edited by hand' > /var/www/html/index.html";

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// The PLAY RECAP lines: one per host.
function recap(text) {
  const rows = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\S+)\s*: ok=(\d+)\s+changed=(\d+)\s+unreachable=(\d+)\s+failed=(\d+)\s+skipped=(\d+)/);
    if (m) rows[m[1]] = { ok: +m[2], changed: +m[3], unreachable: +m[4], failed: +m[5], skipped: +m[6] };
  }
  return rows;
}
const total = (rows, key) => Object.values(rows).reduce((a, r) => a + r[key], 0);
const taskNames = (text) => text.split('\n').filter((l) => /^ {6}\S/.test(l)).map((l) => l.trim().replace(/\s+TAGS:.*$/, ''));

// Run one command, record it, return the result. "text" is the command as you would type it.
function step(argv, note, { text } = {}) {
  const r = ansible(argv);
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  rec.step(shown(text ?? `node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), shown(compactOutput(r.stdout)), typeof note === 'function' ? note(r) : note);
  return r;
}

// The page on each web host, as { web1: '...', web2: '...' }, from the output of an ad hoc "cat".
function pages(r) {
  const out = {};
  const parts = r.stdout.split(/^(web\d) \| \w+ \| rc=\d+ >>\n/m);
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[i + 1].trim();
  return out;
}

try {
  cleanup(CHALLENGE);

  // Step 0: a known start. Three new targets: no nginx, no redis, nothing changed by hand.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // Your playbook must be valid and have both new tasks before the run.
  const syntax = ansible(['ansible-playbook', PLAYBOOK, '--syntax-check']);
  if (syntax.code !== 0) throw new Error(`${PLAYBOOK} is not a valid playbook yet. Ansible says:\n${syntax.stdout.trim()}`);
  const names = taskNames(ansible(['ansible-playbook', PLAYBOOK, '--list-tasks']).stdout);
  if (names.length < MIN_TASKS) {
    throw new Error(`${PLAYBOOK} has ${names.length} task(s) and needs ${MIN_TASKS}. Add "Test the nginx configuration" and "Show the test result" (see the TODO lines) and run this again.`);
  }

  // Step 1: check mode on new servers, where nothing is installed yet.
  const fresh = step(['ansible-playbook', PLAYBOOK, '--check'], (r) => `Check mode on empty servers: the install task says "changed" but installs nothing, so nginx does not exist, and "Start nginx" fails on ${total(recap(r.stdout), 'failed')} hosts. Check mode cannot see past a change it did not make.`);
  const freshRows = recap(fresh.stdout);

  // Step 2: build the servers for real, then prove the playbook is stable.
  const build = step(['ansible-playbook', PLAYBOOK], (r) => `Real run on empty servers: ${total(recap(r.stdout), 'changed')} changes.`);
  if (build.code !== 0) throw new Error('The real run failed. Read the output above.');
  const stable = step(['ansible-playbook', PLAYBOOK], (r) => `Second run: ${total(recap(r.stdout), 'changed')} changes. This is the starting point: servers and playbook agree.`);
  const stableRows = recap(stable.stdout);

  // Step 3: drift. Someone logs in (or runs an ad hoc command) and edits the page on web1 by hand.
  step(['ansible', 'web1', '-b', '-m', 'shell', '-a', DRIFT], 'The page on web1 is now different from what the playbook says. Nothing in Ansible knows yet.', {
    text: `node toolkit/ansible.mjs ansible web1 -b -m shell -a "${DRIFT}"`,
  });

  // Step 4: check mode with diff. Nothing changes on the servers.
  const check = step(['ansible-playbook', PLAYBOOK, '--check', '--diff'], (r) => `Check mode found ${total(recap(r.stdout), 'changed')} change (web1) and made none. The diff shows the line it would replace. The command task shows "skipping" on every web host.`);
  const checkRows = recap(check.stdout);
  const diffRemoved = (check.stdout.match(/^-(Edited by hand)$/m) || [])[1];
  const diffAdded = (check.stdout.match(/^\+(Hello from web1)$/m) || [])[1];
  const emptyDebug = (check.stdout.match(/"msg": \[\]/g) || []).length;

  // Step 5: prove that check mode changed nothing.
  const afterCheck = step(['ansible', 'web', '-m', 'command', '-a', 'cat /var/www/html/index.html'], 'The page on web1 still says what the hand edit wrote. Check mode touched nothing. (command says CHANGED because it always does.)');
  const pageAfterCheck = pages(afterCheck).web1;

  // Step 6: apply for real.
  const apply = step(['ansible-playbook', PLAYBOOK], (r) => `Real run: ${total(recap(r.stdout), 'changed')} change. Only web1 had drifted, and the nginx test command ran this time (it says ok, because of changed_when: false).`);
  const applyRows = recap(apply.stdout);

  // Step 7: run again. Back to zero.
  const after = step(['ansible-playbook', PLAYBOOK], (r) => `Run after the repair: ${total(recap(r.stdout), 'changed')} changes. The servers match the playbook again.`);
  const afterRows = recap(after.stdout);
  const pageAfterApply = pages(ansible(['ansible', 'web', '-m', 'command', '-a', 'cat /var/www/html/index.html'])).web1;

  const facts = {
    'c2.p2.fresh_check_failed_hosts': Object.values(freshRows).filter((r) => r.failed > 0).length,
    'c2.p2.fresh_check_service_error': /Could not find the requested service nginx/.test(fresh.stdout),
    'c2.p2.baseline_changed_run2': total(stableRows, 'changed'),
    'c2.p2.drift_check_changed': total(checkRows, 'changed'),
    'c2.p2.drift_check_skipped': total(checkRows, 'skipped'),
    'c2.p2.drift_check_empty_debug': emptyDebug,
    'c2.p2.diff_removed': diffRemoved,
    'c2.p2.diff_added': diffAdded,
    'c2.p2.page_after_check': pageAfterCheck,
    'c2.p2.drift_apply_changed': total(applyRows, 'changed'),
    'c2.p2.apply_test_task_ok': /TASK \[Test the nginx configuration\][^\n]*\nok: \[web\d\]/.test(apply.stdout),
    'c2.p2.after_changed': total(afterRows, 'changed'),
    'c2.p2.page_after_apply': pageAfterApply,
    'c2.p2.reset_s': round(resetS, 1),
    'c2.p2.playbook_file': PLAYBOOK,
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
        title: 'Changes reported per run: check mode finds the drift, the real run repairs it',
        unit: 'changes',
        bars: [
          { label: 'baseline, second run', value: facts['c2.p2.baseline_changed_run2'] },
          { label: 'drift, check mode', value: facts['c2.p2.drift_check_changed'] },
          { label: 'drift, real run', value: facts['c2.p2.drift_apply_changed'] },
          { label: 'after repair', value: facts['c2.p2.after_changed'] },
          { label: 'tasks skipped in check', value: facts['c2.p2.drift_check_skipped'] },
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
