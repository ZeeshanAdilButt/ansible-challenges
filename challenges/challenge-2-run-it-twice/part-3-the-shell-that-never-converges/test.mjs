// Challenge 2, part 3 test.
// Run: node --test challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/test.mjs
// It fails until you have written module-version.yml and creates-version.yml and run run.mjs once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hint = 'Run: node challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges/run.mjs';
// The run records which folder it used, so a maintainer run with --reference is checked too.
const dir = getFact('c2.p3.playbook_dir') ?? 'challenges/challenge-2-run-it-twice/part-3-the-shell-that-never-converges';

function taskCount(file) {
  const r = ansible(['ansible-playbook', `${dir}/${file}`, '--list-tasks']);
  assert.equal(r.code, 0, `Ansible could not read ${dir}/${file}. Is the fleet running? node toolkit/fleet.mjs up\n${r.stdout}`);
  return r.stdout.split('\n').filter((l) => /^ {6}\S/.test(l)).length;
}

test('module-version.yml and creates-version.yml have their tasks', () => {
  const m = taskCount('module-version.yml');
  assert.ok(m >= 3, `module-version.yml has ${m} task(s), it needs 3 (lineinfile, apt, file). Follow the TODO lines.`);
  const c = taskCount('creates-version.yml');
  assert.ok(c >= 4, `creates-version.yml has ${c} task(s), it needs 4 (the four tasks of shell-version.yml). Follow the TODO lines.`);
});

test('the shell version changes things on every run', () => {
  for (const n of [1, 2, 3]) {
    assert.equal(getFact(`c2.p3.shell_changed_run${n}`), 8, `c2.p3.shell_changed_run${n} should be 8 (4 tasks on 2 hosts, every time). ${hint}`);
  }
  assert.equal(getFact('c2.p3.shell_conf_lines'), 3, `After three runs /etc/myapp.conf should hold 3 lines: the append ran 3 times. ${hint}`);
});

test('the module version changes things once and then nothing', () => {
  assert.equal(getFact('c2.p3.module_changed_run1'), 6, `c2.p3.module_changed_run1 should be 6 (3 tasks on 2 hosts). ${hint}`);
  assert.equal(getFact('c2.p3.module_changed_run2'), 0, `c2.p3.module_changed_run2 should be 0. ${hint}`);
  assert.equal(getFact('c2.p3.module_changed_run3'), 0, `c2.p3.module_changed_run3 should be 0: a module checks first. ${hint}`);
  assert.equal(getFact('c2.p3.module_conf_lines'), 1, `The module version should leave 1 line in /etc/myapp.conf. ${hint}`);
});

test('the creates version is safe to repeat', () => {
  assert.equal(getFact('c2.p3.creates_changed_run1'), 6, `c2.p3.creates_changed_run1 should be 6 (3 tasks on 2 hosts; the read task never says changed). ${hint}`);
  assert.equal(getFact('c2.p3.creates_changed_run2'), 0, `c2.p3.creates_changed_run2 should be 0. Did you add creates: to all three tasks and changed_when: false to the read task? ${hint}`);
  assert.equal(getFact('c2.p3.creates_changed_run3'), 0, `c2.p3.creates_changed_run3 should be 0. ${hint}`);
  assert.equal(getFact('c2.p3.creates_conf_lines'), 1, `The creates version should leave 1 line in /etc/myapp.conf. ${hint}`);
});

test('the fleet is running now', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) {
    assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  }
});

test('nothing with the challenge label is left in Docker', () => {
  assert.deepEqual(leftovers(2), { containers: 0, networks: 0, volumes: 0 });
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
