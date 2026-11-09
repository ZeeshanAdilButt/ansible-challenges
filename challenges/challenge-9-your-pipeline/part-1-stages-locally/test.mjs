// Challenge 9, part 1 test.
// Run: node --test challenges/challenge-9-your-pipeline/part-1-stages-locally/test.mjs
// It fails until you have written the guard in guard.yml and run run.mjs once. That is on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leftovers } from '../../../toolkit/docker.js';
import { getFact } from '../../../toolkit/facts.js';
import { fleetRunning, execIn } from '../../../toolkit/fleet.mjs';
import { ansible, countLines } from '../../../toolkit/ansible.mjs';
import { STAGES } from './ci.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PART = 'challenges/challenge-9-your-pipeline/part-1-stages-locally';
const hint = `Run: node ${PART}/run.mjs`;

test('guard.yml has a real test, not the placeholder', () => {
  const text = readFileSync(join(here, getFact('c9.p1.guard_file') === 'reference/guard.yml' ? 'reference/guard.yml' : 'guard.yml'), 'utf8');
  assert.doesNotMatch(text, /^\s*-\s*false\s*$/m, 'guard.yml still has "- false". Open it, read the TODO, and write the test: deploy_environment must equal "practice".');
  assert.match(text, /deploy_environment/, 'guard.yml should test the variable deploy_environment.');
  assert.doesNotMatch(text, /that:\s*\n\s*-\s*environment\b/, 'Do not use a variable called "environment": it is an Ansible keyword and Ansible ignores it.');
});

test('the guard refuses production before any SSH connection, and passes practice', () => {
  assert.equal(getFact('c9.p1.guard_refused'), true, `The guard should refuse the fake production inventory. ${hint}`);
  assert.equal(getFact('c9.p1.guard_ssh_attempts'), 0, `The guard must stop the run before Ansible opens an SSH connection. ${hint}`);
  assert.equal(getFact('c9.p1.guard_passes_practice'), true, `The guard should pass for the practice inventory. ${hint}`);
  assert.equal(getFact('c9.p1.guard_refuses_unset'), true, `The guard should refuse when deploy_environment is not set at all. ${hint}`);
  assert.equal(getFact('c9.p1.pipeline_refused_production'), true, `The pipeline should stop at the guard when it is given the production inventory. ${hint}`);
});

test('now: the guard still refuses production (live)', () => {
  const r = ansible(['ansible-playbook', '-i', `${PART}/inventory/production.ini`, `${PART}/site.yml`]);
  assert.notEqual(r.code, 0, `The run against production should fail:\n${r.stdout}`);
  assert.match(r.stdout, /Refusing to run/, `The refusal text is missing:\n${r.stdout}`);
  assert.doesNotMatch(r.stdout, /UNREACHABLE/, 'Ansible tried to connect to the fake production host. The guard must come first.');
});

test('all six stages passed in order and the second run changed nothing', () => {
  assert.equal(getFact('c9.p1.stages_passed'), STAGES.length, `All ${STAGES.length} stages should pass. ${hint}`);
  for (const s of STAGES) assert.ok(getFact(`c9.p1.stage_${s.replaceAll('-', '_')}_s`) >= 0, `The time of stage ${s} is missing. ${hint}`);
  assert.equal(getFact('c9.p1.check_would_change'), 2, `Check mode should say 2 hosts would change. ${hint}`);
  assert.equal(getFact('c9.p1.apply_changed'), 2, `Apply should change 2 hosts. ${hint}`);
  assert.equal(getFact('c9.p1.second_run_changed'), 0, `The second run must change 0 hosts. ${hint}`);
  assert.equal(getFact('c9.p1.lint_profile'), 'production');
});

test('a broken playbook stops at lint and skips the rest', () => {
  assert.equal(getFact('c9.p1.broken_failed_stage'), 'lint', `broken-site.yml should fail at the lint stage. ${hint}`);
  assert.equal(getFact('c9.p1.broken_skipped'), STAGES.length - 1, `The five stages after lint should be skipped. ${hint}`);
});

test('now: the role puts the banner on web1 and web2, and a second run changes nothing (live)', () => {
  // Another part may have reset the fleet since run.mjs ran, so apply the role again with a small playbook of our own.
  // (site.yml is not used here: a maintainer run uses reference/guard.yml and leaves the unfinished starter in guard.yml.)
  const tmp = join(here, 'tmp-apply-role.yml');
  writeFileSync(tmp, ['---', '- name: Apply the banner role', '  hosts: web', '  become: true', '  roles:', '    - role: banner', ''].join(String.fromCharCode(10)));
  try {
    const args = ['ansible-playbook', '-i', `${PART}/inventory/practice.ini`, `${PART}/tmp-apply-role.yml`];
    const first = ansible(args);
    assert.equal(first.code, 0, `The role failed:
${first.stdout}`);
    const second = ansible(args);
    assert.equal(second.code, 0, `The second run failed:
${second.stdout}`);
    assert.equal(countLines(second.stdout, /changed=[1-9]/), 0, `A second run changes something, so the role is not idempotent:
${second.stdout}`);
  } finally {
    rmSync(tmp, { force: true });
  }
  for (const h of ['web1', 'web2']) {
    const r = execIn(h, ['cat', '/etc/banner.d/welcome.txt']);
    assert.ok(r.stdout.startsWith(`Welcome to ${h}.`), `${h} has no banner. ${hint}`);
  }
});

test('the fleet is running, and no Molecule container is left', () => {
  const running = fleetRunning();
  for (const s of ['control', 'web1', 'web2', 'db1']) assert.ok(running.includes(s), `${s} is not running. Start the fleet: node toolkit/fleet.mjs up`);
  assert.deepEqual(leftovers(9), { containers: 0, networks: 0, volumes: 0 });
});

test('the README names the Docker socket exception and links the safety rules', () => {
  const readme = readFileSync(join(here, 'README.md'), 'utf8');
  assert.match(readme, /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
  assert.match(readme, /Docker socket/i, 'The README must name the Docker socket exception.');
});

test('results.md and chart.svg exist after a recorded run', () => {
  assert.ok(existsSync(join(here, 'results.md')), 'Run run.mjs with --record to write results.md');
  const svg = readFileSync(join(here, 'chart.svg'), 'utf8');
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="t">/);
  assert.match(svg, /<desc id="d">/);
});
