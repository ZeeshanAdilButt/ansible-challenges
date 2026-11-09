// Challenge 5, part 1: move a playbook into a role.
// Run: node challenges/challenge-5-your-first-role/part-1-move-to-a-role/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the finished role in reference/ (for maintainers).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';
import { handlerHosts, parseRecap, total } from '../recap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 5, part 1: move a playbook into a role');
const CHALLENGE = 5;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-5-your-first-role/part-1-move-to-a-role';
const BEFORE = `${PART}/before.yml`;
const SITE = `${PART}/${reference ? 'reference/' : ''}site.yml`;
const ROLES = `${PART}/${reference ? 'reference/' : ''}roles`;
// A --reference run uses the fixed files, but results.md shows the paths a learner types.
const shownPath = (text) => text.replaceAll('/reference/', '/');

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

// Lines that hold code: not empty, not a comment, not the --- line.
const codeLines = (path) =>
  readFileSync(join(here, '..', '..', '..', path), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l !== '---').length;

const changedSum = (r) => total(parseRecap(r.stdout), 'changed');

try {
  cleanup(CHALLENGE);

  // Step 0: a known start. Three new targets.
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // 1. The old playbook, twice.
  const b1 = step(['ansible-playbook', BEFORE], (r) => `Changed ${changedSum(r)}: 5 tasks and the handler changed on each of 2 web hosts. Handler runs: ${handlerHosts(r.stdout, 'Reload nginx').length}.`);
  if (b1.code !== 0) throw new Error('before.yml failed. It is given to you, so check the fleet: node toolkit/fleet.mjs reset');
  const b2 = step(['ansible-playbook', BEFORE], (r) => `Changed ${changedSum(r)}. This is the "before" picture: it works, and the second run changes nothing.`);

  // 2. Your role: do the tasks show up where they should?
  const list = step(['ansible-playbook', SITE, '--list-tasks'], 'ansible-playbook can list the tasks without running them. A task that comes from a role is shown with the role name in front.');
  const tasksMoved = list.stdout.split('\n').filter((l) => /^\s+webserver : /.test(l)).length;
  if (tasksMoved === 0) {
    throw new Error('No task comes from the role webserver. Do TODO 1 (tasks) and TODO 6 (roles: in site.yml), then run this again.');
  }

  // 3. The role on fresh targets: the same four changes, and no change on the second run.
  const resetS2 = await fleetReset();
  console.log(`Targets new again in ${round(resetS2, 1)} s`);
  const r1 = step(['ansible-playbook', SITE], (r) => `Changed ${changedSum(r)}. Handler runs: ${handlerHosts(r.stdout, 'Reload nginx').length}. The same numbers as the playbook.`);
  if (r1.code !== 0) throw new Error('site.yml with the role failed. Read the error above. Common causes: a file in the role is still empty, or a name does not match.');
  const r2 = step(['ansible-playbook', SITE], (r) => `Changed ${changedSum(r)}.`);

  // 4. A default is the weakest value. A caller can override it, here with -e.
  const r3 = step(['ansible-playbook', SITE, '-e', 'site_port=9090'], (r) => `Changed ${changedSum(r)}: the template changed and the handler ran, on each host.`);
  const grep = step(['ansible', 'web', '-m', 'command', '-a', 'grep listen /etc/nginx/conf.d/site.conf'], 'The config now says 9090.');

  // 5. A real mistake: a typo in the role name.
  const typo = step(['ansible-playbook', `${PART}/typo.yml`], (r) => `Exit code ${r.code}. Ansible looked for the role in the places it knows and did not find it.`);
  const typoMsg = (typo.stdout.match(/The role '[^']+' was not found[^\n]*/) || [])[0] ?? '';

  const meta = readFileSync(join(here, '..', '..', '..', ROLES, 'webserver', 'meta', 'main.yml'), 'utf8');
  const metaValue = (key) => (meta.match(new RegExp(`^\\s+${key}:\\s*(.+?)\\s*$`, 'm')) || [])[1] ?? '';

  const facts = {
    'c5.p1.tasks_moved': tasksMoved,
    'c5.p1.playbook_lines_before': codeLines(BEFORE),
    'c5.p1.playbook_lines_after': codeLines(SITE),
    'c5.p1.before_changed_run1': changedSum(b1),
    'c5.p1.before_changed_run2': changedSum(b2),
    'c5.p1.role_changed_run1': changedSum(r1),
    'c5.p1.role_changed_run2': changedSum(r2),
    'c5.p1.role_handler_runs_run1': handlerHosts(r1.stdout, 'Reload nginx').length,
    'c5.p1.override_changed': changedSum(r3),
    'c5.p1.override_port_9090': /listen 9090;/.test(grep.stdout),
    'c5.p1.typo_exit_code': typo.code,
    'c5.p1.typo_message': typoMsg.slice(0, 120),
    'c5.p1.meta_namespace': metaValue('namespace'),
    'c5.p1.meta_role_name': metaValue('role_name'),
    'c5.p1.reset_s': round(resetS, 1),
    'c5.p1.site_file': SITE,
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1 || v === '') throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used the files in reference/; the paths below show the files without it' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Lines of code in the playbook, before and after the move',
        unit: 'lines',
        bars: [
          { label: 'before.yml', value: facts['c5.p1.playbook_lines_before'] },
          { label: 'site.yml (after)', value: facts['c5.p1.playbook_lines_after'] },
          { label: 'tasks moved into the role', value: facts['c5.p1.tasks_moved'] },
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
