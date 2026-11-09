// Challenge 2, part 3: the shell that never converges.
// Run: node challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run the fixed playbooks in reference/ (for maintainers).

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
const rec = new Recorder('Challenge 2, part 3: the shell that never converges');
const CHALLENGE = 2;

// The folder of this part, as the control container sees it (the repository is mounted at /work).
const PART = 'challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges';
const SUB = reference ? 'reference/' : '';
const FILES = {
  shell: `${PART}/${SUB}shell-version.yml`,
  module: `${PART}/${SUB}module-version.yml`,
  creates: `${PART}/${SUB}creates-version.yml`,
};
// A --reference run uses the fixed files, but results.md shows the paths a learner types.
const shown = (text) => text.replaceAll('/reference/', '/');

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

// Run one command, record it, return the result.
function step(argv, note) {
  const r = ansible(argv);
  const quote = (a) => (/[\s:&!*"]/.test(a) ? `'${a}'` : a);
  rec.step(shown(`node toolkit/ansible.mjs ${argv.map(quote).join(' ')}`), shown(compactOutput(r.stdout)), typeof note === 'function' ? note(r) : note);
  return r;
}

// Lines of /etc/myapp.conf on web1, from the output of an ad hoc "cat".
const confLines = (r) => r.stdout.split('\n').slice(1).filter((l) => l.trim() !== '').length;

// One version of the job: new servers, then three runs of the same playbook.
async function version(key, title) {
  const file = FILES[key];
  const resetS = await fleetReset();
  console.log(`\n${title}: servers new again after ${round(resetS, 1)} s`);
  const changed = [];
  for (let i = 1; i <= 3; i++) {
    const r = step(['ansible-playbook', file], (res) => `${title}, run ${i}: ${total(recap(res.stdout), 'changed')} changes in total (${Object.entries(recap(res.stdout)).map(([h, v]) => `${h} ${v.changed}`).join(', ')}).`);
    if (r.code !== 0) throw new Error(`${title}: run ${i} failed. Read the output above.`);
    changed.push(total(recap(r.stdout), 'changed'));
  }
  const conf = step(['ansible', 'web1', '-b', '-m', 'command', '-a', 'cat /etc/myapp.conf'], (r) => `/etc/myapp.conf on web1 now holds ${confLines(r)} line(s).`);
  return { changed, lines: confLines(conf) };
}

// Your two playbooks need their tasks before anything runs.
function checkTasks(key, min, what) {
  const names = taskNames(ansible(['ansible-playbook', FILES[key], '--list-tasks']).stdout);
  if (names.length < min) {
    throw new Error(`${FILES[key]} has ${names.length} task(s) and needs ${min}${what}. Follow the TODO lines in the file and run this again.`);
  }
}

try {
  cleanup(CHALLENGE);

  for (const key of ['module', 'creates']) {
    const syntax = ansible(['ansible-playbook', FILES[key], '--syntax-check']);
    if (syntax.code !== 0) throw new Error(`${FILES[key]} is not a valid playbook yet. Ansible says:\n${syntax.stdout.trim()}`);
  }
  checkTasks('module', 3, ' (lineinfile, apt, file)');
  checkTasks('creates', 4, ' (the four tasks of shell-version.yml)');

  const shell = await version("shell", "Shell and command");
  const module = await version("module", "Modules");
  const creates = await version("creates", "Shell and command with creates");

  const facts = {
    'c2.p3.shell_changed_run1': shell.changed[0],
    'c2.p3.shell_changed_run2': shell.changed[1],
    'c2.p3.shell_changed_run3': shell.changed[2],
    'c2.p3.shell_conf_lines': shell.lines,
    'c2.p3.module_changed_run1': module.changed[0],
    'c2.p3.module_changed_run2': module.changed[1],
    'c2.p3.module_changed_run3': module.changed[2],
    'c2.p3.module_conf_lines': module.lines,
    'c2.p3.creates_changed_run1': creates.changed[0],
    'c2.p3.creates_changed_run2': creates.changed[1],
    'c2.p3.creates_changed_run3': creates.changed[2],
    'c2.p3.creates_conf_lines': creates.lines,
    'c2.p3.playbook_dir': `${PART}/${SUB}`.replace(/\/$/, ''),
  };
  for (const [k, v] of Object.entries(facts)) {
    if (v === undefined || v === -1) throw new Error(`Could not read the value for ${k}. Look at the output above.`);
    setFact(k, v);
  }

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run used the files in reference/; the paths below show the files in the part folder' : ''}`);
    const bars = [];
    for (const [label, v] of [['shell and command', shell], ['modules', module], ['creates', creates]]) {
      v.changed.forEach((c, i) => bars.push({ label: `${label}, run ${i + 1}`, value: c }));
    }
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({ title: 'Changes per run for three ways to write the same job (both web hosts added up)', unit: 'changes', bars }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
