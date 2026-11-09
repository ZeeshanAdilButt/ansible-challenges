// Challenge 7, part 3: break idempotence on purpose, read the failure, fix it.
// Run: node challenges/challenge-7-test-your-role/part-3-break-idempotence/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to use reference/main.yml as your tasks file (for maintainers; your file is put back afterwards).
//
// THE ONE EXCEPTION to "no Docker socket": Molecule runs in the container anp-c7-molecule, which has
// /var/run/docker.sock mounted. See toolkit/molecule.mjs and SAFETY.md.

import { appendFileSync, copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder, compactOutput } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { installCollections, moleculeDown, moleculeUp } from '../../../toolkit/molecule.mjs';
import { CHALLENGE, molecule, parseRecap, secondsSince, stepOutput } from '../shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 7, part 3: break idempotence');
const PART = 'challenges/challenge-7-test-your-role/part-3-break-idempotence';
const ROLE = `${PART}/roles/webserver`;
const BROKEN_ROLE = `${PART}/scratch/broken/webserver`;
const tasksPath = join(here, 'roles', 'webserver', 'tasks', 'main.yml');

// The task that goes wrong: command always says "changed", because Ansible cannot know that nginx -t only reads.
const BROKEN_TASK = `
- name: Check the nginx config
  ansible.builtin.command: nginx -t
`;

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

/** The tasks the idempotence step names as failing: lines like "*  [instance] => role : task name". */
function failedTasks(text) {
  const out = stepOutput(text, 'idempotence');
  const i = out.indexOf('Idempotence test failed because of the following tasks:');
  if (i < 0) return [];
  return out
    .slice(i)
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => /^\s*\*\s/.test(l))
    .map((l) => l.trim());
}
const failureBlock = (text) => {
  const out = stepOutput(text, 'idempotence');
  const i = out.indexOf('Idempotence test failed');
  return i < 0 ? '' : out.slice(i).split(/\r?\n/).slice(0, 6).join('\n');
};

const originalTasks = readFileSync(tasksPath, 'utf8');
try {
  cleanup(CHALLENGE);
  if (reference) copyFileSync(join(here, 'reference', 'main.yml'), tasksPath);

  const mine = readFileSync(tasksPath, 'utf8');
  if (!/Check the nginx config/.test(mine)) {
    throw new Error(`${ROLE}/tasks/main.yml has no "Check the nginx config" task yet. Add the task from the README (step 2) with changed_when: false, then run this again.`);
  }
  if (!/changed_when:\s*false/.test(mine)) {
    throw new Error(`The "Check the nginx config" task in ${ROLE}/tasks/main.yml has no changed_when: false yet. That is the fix: Molecule will fail the idempotence step until you add it. Add it and run this again.`);
  }

  await moleculeUp(CHALLENGE);
  installCollections(CHALLENGE);

  // 1. A broken copy of the role: the working role plus the task, without the fix. It lives in scratch/ (git ignores it).
  const base = join(here, 'base-role', 'webserver');
  const brokenDir = join(here, 'scratch', 'broken', 'webserver');
  rmSync(join(here, 'scratch'), { recursive: true, force: true });
  mkdirSync(dirname(brokenDir), { recursive: true });
  cpSync(base, brokenDir, { recursive: true });
  appendFileSync(join(brokenDir, 'tasks', 'main.yml'), BROKEN_TASK);
  rec.step(`tail -n 4 ${BROKEN_ROLE}/tasks/main.yml`, readFileSync(join(brokenDir, 'tasks', 'main.yml'), 'utf8').trimEnd().split('\n').slice(-3).join('\n'), 'The new task runs nginx -t to check the config. It only reads, but the command module reports changed on every run.');

  const t0 = process.hrtime.bigint();
  const broken = molecule(BROKEN_ROLE, ['test']);
  const brokenS = secondsSince(t0);
  const beforeTasks = failedTasks(broken.stdout);
  const idem = stepOutput(broken.stdout, 'idempotence');
  const recapBroken = parseRecap(broken.stdout);
  rec.step(`node toolkit/molecule.mjs run 7 ${BROKEN_ROLE} molecule test`, compactOutput(broken.stdout), `Exit code ${broken.code}. The idempotence step failed. It names ${beforeTasks.length} task: ${beforeTasks.join(' | ') || 'none found'}. The verify step never ran. Molecule still destroyed the test machine. The recap at the end says failed=${recapBroken?.failed}, although the exit code is not 0 (see NOTES.md). This run took ${brokenS} s.`);
  if (broken.code === 0) throw new Error('The broken role passed molecule test. The idempotence step should have failed.');

  // 2. The fix, in your role.
  const t1 = process.hrtime.bigint();
  const fixed = molecule(ROLE, ['test']);
  const fixedS = secondsSince(t1);
  const afterTasks = failedTasks(fixed.stdout);
  const recapFixed = parseRecap(fixed.stdout);
  rec.step(`node toolkit/molecule.mjs run 7 ${ROLE} molecule test`, compactOutput(fixed.stdout), `Exit code ${fixed.code}. With changed_when: false the idempotence step passes (${afterTasks.length} failing tasks) and verify runs. This run took ${fixedS} s.`);

  const facts = {
    'c7.p3.idempotence_failed_tasks_before': beforeTasks.length,
    'c7.p3.idempotence_failed_tasks_after': afterTasks.length,
    'c7.p3.broken_exit_code': broken.code,
    'c7.p3.fixed_exit_code': fixed.code,
    'c7.p3.failing_task': (beforeTasks[0] ?? '').replace(/^\*\s*/, ''),
    'c7.p3.failure_text': failureBlock(broken.stdout).split('\n').slice(0, 3).join(' | '),
    'c7.p3.verify_ran_after_failure': /\[default > verify\] Executing/.test(broken.stdout),
    'c7.p3.destroy_after_failure': /\[default > destroy\] Executed: Successful/.test(broken.stdout.slice(broken.stdout.indexOf('Idempotence test failed'))),
    'c7.p3.broken_recap_failed': recapBroken?.failed ?? -1,
    'c7.p3.broken_recap_successful': recapBroken?.successful ?? -1,
    'c7.p3.fixed_steps_passed': recapFixed?.successful ?? -1,
    'c7.p3.idempotence_changed_lines_before': (idem.match(/^changed: \[/gm) ?? []).length,
  };
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  moleculeDown(CHALLENGE);
  rmSync(join(here, 'scratch'), { recursive: true, force: true });
  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used reference/main.yml' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Tasks that failed the idempotence step, before and after the fix',
        unit: 'tasks',
        bars: [
          { label: 'broken role', value: facts['c7.p3.idempotence_failed_tasks_before'] },
          { label: 'fixed role', value: facts['c7.p3.idempotence_failed_tasks_after'] },
        ],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (reference) writeFileSync(tasksPath, originalTasks);
  cleanup(CHALLENGE);
}
